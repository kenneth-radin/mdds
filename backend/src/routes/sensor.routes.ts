import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { ISensorReading } from '../models/SensorReading';
import { SensorReading } from '../models/SensorReading';
import { Machine } from '../models/Machine';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../middleware/error';
// @ts-ignore - firebase-admin.js is a JS module without type declarations
import { db } from '../firebase-admin';

const route = Router();


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

// Rate limit: 10 requests per second per IP to protect against a misbehaving device.
const deviceIngestLimiter = rateLimit({
  windowMs: 1000,
  max: 10,
  message: { error: 'Too many device ingestion requests. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Device-key auth: X-Device-Key header checked against DEVICE_INGEST_KEY env var.
function requireDeviceKey(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  const key = req.headers['x-device-key'];
  if (!key || key !== process.env.DEVICE_INGEST_KEY) {
    return res.status(401).json({ error: 'Invalid or missing device key' });
  }
  next();
}

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

route.post('/data', requireAuth, validateBody(batchReadingSchema), asyncHandler(async (req, res) => {
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

route.post('/test', requireAuth, asyncHandler(async (req, res) => {
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

// Hardware ingestion endpoint: device-key authenticated, write-triggered Firebase sync.
// Auth: X-Device-Key header vs DEVICE_INGEST_KEY env var (no JWT required).
// Rate limit: 10 req/sec per IP.
// On Firebase push failure: still returns 200 (reading saved, sync best-effort).
const deviceReadingSchema = z.object({
  temperature: z.number().min(-50).max(150),
  vibration: z.number().min(0).max(20),
  timestamp: z.string().datetime().optional(),
  operatingHours: z.number().min(0).optional(),
  source: z.string().optional()
});

route.post('/devices/readings', deviceIngestLimiter, requireDeviceKey, validateBody(deviceReadingSchema), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof deviceReadingSchema>;
  const machineDoc = await Machine.findOne({ machineId: defaultMachineId });
  const machine = machineDoc?._id;

  const reading = new SensorReading({
    machine,
    temperature: body.temperature,
    vibration: body.vibration,
    operatingHours: body.operatingHours ?? 0,
    date: body.timestamp ? new Date(body.timestamp) : new Date(),
    source: body.source || 'device',
    syncedToFirebase: true // optimistic; set to false below if Firebase push fails
  });
  await reading.save();

  let firebasePushOk = false;
  if (db) {
    try {
      await db.ref("sensorReadings").push({
        temperature: reading.temperature,
        vibration: reading.vibration,
        timestamp: reading.date.toISOString(),
        equipmentId: "CMP-001",
        source: reading.source
      });
      firebasePushOk = true;
    } catch (error) {
      console.error("[device-ingest] Firebase push failed, reading saved to Mongo only:", error instanceof Error ? error.message : error);
    }
  } else {
    console.warn("[device-ingest] Firebase not initialized; reading saved to Mongo only.");
  }

  // Persist the sync outcome so we can query "how many readings failed to sync recently."
  if (!firebasePushOk) {
    reading.syncedToFirebase = false;
    await reading.save();
  }

  res.status(200).json({
    ok: true,
    readingId: reading._id,
    syncedToFirebase: firebasePushOk
  });
}));

export default route;

