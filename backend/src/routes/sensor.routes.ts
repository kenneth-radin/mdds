import { Router } from 'express';
import { z } from 'zod';
import { ISensorReading } from '../models/SensorReading';
import { SensorReading } from '../models/SensorReading';
import { Machine } from '../models/Machine';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../middleware/error';

const route = Router();

route.use((req, res, next) => {
  requireAuth(req, res, next).catch(next);
});

const singleReadingSchema = z.object({
  temperature: z.number().min(-50).max(150),
  vibration: z.number().min(0).max(20),
  timestamp: z.string().datetime().optional(),
  source: z.string().optional(),
});

const batchReadingSchema = z.object({
  readings: z.array(singleReadingSchema),
});

const defaultMachineId = 'CMP-001';

route.get('/latest', asyncHandler(async (_req, res) => {
  const reading = await SensorReading.findOne({ machine: defaultMachineId })
    .sort({ date: -1 })
    .lean() as ISensorReading | null;
  res.json(reading ? singleReadingSchema.parse(reading) : null);
}));

route.get('/latest-by-machine', asyncHandler(async (req, res) => {
  const machineId = req.params.machineId || 'CMP-001';
  const reading = await SensorReading.findOne({ machine: machineId })
    .sort({ date: -1 })
    .lean() as ISensorReading | null;
  res.json(reading ? singleReadingSchema.parse(reading) : null);
}));

route.get('/history', asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
  const readings = await SensorReading.find({ machine: defaultMachineId })
    .sort({ date: -1 })
    .limit(limit)
    .lean() as unknown as ISensorReading[];
  res.json(readings.map(r => singleReadingSchema.parse(r)));
}));

route.get('/stream', asyncHandler(async (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const reading = await SensorReading.findOne({ machine: defaultMachineId })
    .sort({ date: -1 })
    .lean() as ISensorReading | null;
  if (reading) {
    res.write(`data: ${JSON.stringify(singleReadingSchema.parse(reading))}\n\n`);
  }
  setTimeout(() => res.end(), 5000);
}));

route.post('/data', validateBody(batchReadingSchema), asyncHandler(async (req, res) => {
  const body = req.body;
  const readings: Array<{
    temperature: number;
    vibration: number;
    operatingHours?: number;
    timestamp?: string;
    source?: string;
  }> = Array.isArray(body.readings) ? body.readings : [body];
  
  const machineDoc = await Machine.findOne({ machineId: defaultMachineId });
  const machine = machineDoc?._id;

  const results = await Promise.allSettled(
    readings.map(async (item) => {
      const reading = new SensorReading({
        machine,
        temperature: item.temperature,
        vibration: item.vibration,
        operatingHours: item.operatingHours ?? 0,
        date: item.timestamp ? new Date(item.timestamp) : new Date(),
        source: item.source || 'manual',
      });
      await reading.save();
      return reading._id.toString();
    })
  );
  
  const successful = results.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled');
  const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  
  res.json({
    ok: successful.length > 0,
    saved: successful.map(r => r.value),
    errors: errors.map(e => e.reason?.message || 'Unknown error'),
    total: results.length
  });
}));

route.post('/test', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const machineDoc = await Machine.findOne({ machineId: defaultMachineId });
  const machine = machineDoc?._id;
  const reading = new SensorReading({
    temperature: body.temperature ?? 0,
    vibration: body.vibration ?? 0,
    operatingHours: body.operatingHours ?? 0,
    date: body.date ? new Date(body.date) : new Date(),
    source: body.source || 'manual',
  });
  await reading.save();
  res.json({
    ok: true,
    reading: singleReadingSchema.parse({
      _id: reading._id,
      machine: reading.machine,
      temperature: reading.temperature,
      vibration: reading.vibration,
      operatingHours: reading.operatingHours,
      date: reading.date,
      source: reading.source
    })
  });
}));

export default route;

