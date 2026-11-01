import { Router } from 'express';
import { Types } from 'mongoose';
import { ServerResponse, IncomingMessage } from 'http';
import { z } from 'zod';
import { SensorReading, ISensorReading } from '../models/SensorReading';
import { AnomalyDetector, DEFAULT_THRESHOLDS } from '../services/anomalyService';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../middleware/error';

const router = Router();
router.use(requireAuth);

const readingSchema = z.object({
  temperature: z.number().min(-50).max(150),
  vibration: z.number().min(0).max(20),
  operatingHours: z.number().min(0).optional(),
  timestamp: z.string().datetime().optional(),
  source: z.string().optional()
});

const DEFAULT_MACHINE = 'CMP-001';

function serialize(r: ISensorReading): SensorReadingDto {
  return {
    id: r._id.toHexString(),
    machineId: r.machine.toHexString(),
    timestamp: r.date.toISOString(),
    temperature: r.temperature,
    vibration: r.vibration,
    operatingHours: r.operatingHours,
    source: r.source
  };
}

interface SensorReadingDto {
  id: string;
  machineId: string;
  timestamp: string;
  temperature: number;
  vibration: number;
  operatingHours: number;
  source: string;
}

// SSE clients (in-memory). New readings are broadcast to subscribers in
// POST /sensor-data.
const sseClients: Set<ServerResponse<IncomingMessage>> = new Set();

router.get('/latest', asyncHandler(async (_req, res) => {
  const reading = await SensorReading.findOne({ machine: DEFAULT_MACHINE })
    .sort({ date: -1 })
    .lean() as ISensorReading | null;
  res.json({ reading: reading ? serialize(reading) : null });
}));

router.get('/history', asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
  const readings = await SensorReading.find({ machine: DEFAULT_MACHINE })
    .sort({ date: -1 })
    .limit(limit)
    .lean() as unknown as ISensorReading[];
  res.json({ readings: readings.map(serialize).reverse() });
}));

router.get('/stream', asyncHandler(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const latest = await SensorReading.findOne({ machine: DEFAULT_MACHINE })
    .sort({ date: -1 })
    .lean() as ISensorReading | null;
  res.write(`data: ${JSON.stringify({ ok: true, sample: 'SSE stream open', latest: latest ? serialize(latest) : null })}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}));

router.post('/sensor-data', validateBody(readingSchema), asyncHandler(async (req, res) => {
  const body = req.body;
  const reading = new SensorReading({
    machine: new Types.ObjectId(DEFAULT_MACHINE),
    temperature: body.temperature,
    vibration: body.vibration,
    operatingHours: body.operatingHours ?? 0,
    date: body.timestamp ? new Date(body.timestamp) : new Date(),
    source: body.source || 'manual'
  });
  await reading.save();

  const detector = new AnomalyDetector();
  const history = await SensorReading.find({ machine: reading.machine })
    .sort({ date: -1 })
    .limit(100)
    .lean() as unknown as ISensorReading[];
  const detected = detector.analyze(reading as ISensorReading, history.reverse(), DEFAULT_THRESHOLDS);

  // Push the new reading to everyone subscribed to the sensor stream.
  sseClients.forEach((client) => {
    client.write(`data: ${JSON.stringify({ ...serialize(reading), anomaly: detected })}\n\n`);
  });

  res.json({ reading: serialize(reading), anomaly: detected });
}));

export default router;
