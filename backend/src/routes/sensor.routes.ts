import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { ISensorReading } from '../models/SensorReading';
import { SensorReading } from '../models/SensorReading';
import { Alert } from '../models/Alert';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../middleware/error';
// @ts-ignore - firebase-admin.js is a JS module without type declarations
import { db } from '../firebase-admin';
import { AnomalyDetector } from '../services/anomalyService';
import { MachineState } from '../models/MachineState';

import { DEFAULT_THRESHOLDS } from '../utils/helpers';
import { getRecommendationForDetection } from '../services/recommendationTemplates';

const route = Router();


const singleReadingSchema = z.object({
  temperature: z.number().min(-50).max(150),
  vibration: z.number().min(0).max(20),
  humidity: z.number().min(0).max(100).optional(),
  timestamp: z.number().optional(), // Unix epoch milliseconds
  source: z.string().optional(),
}).passthrough();

const batchReadingSchema = z.object({
  readings: z.array(singleReadingSchema),
});

const defaultMachineId = 'CMP-001';

// Time-range options for historical queries
const HISTORICAL_RANGES = {
  '1h': { hours: 1 },
  '24h': { hours: 24 },
  '7d': { days: 7 },
  '30d': { days: 30 },
} as const;

type HistoricalRange = keyof typeof HISTORICAL_RANGES;

function getRangeStart(range: HistoricalRange | undefined): number | null {
  if (!range || !(range in HISTORICAL_RANGES)) return null;
  const spec = HISTORICAL_RANGES[range];
  const now = Date.now();
  if ('hours' in spec) {
    return now - spec.hours * 60 * 60 * 1000;
  }
  if ('days' in spec) {
    return now - spec.days * 24 * 60 * 60 * 1000;
  }
  return null;
}

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

route.get('/sensor-data/latest', asyncHandler(async (_req, res) => {
  const reading = await SensorReading.findOne({ machine: defaultMachineId })
    .sort({ date: -1 })
    .lean() as ISensorReading | null;
  res.json(reading ? singleReadingSchema.parse(reading) : null);
}));

route.get('/sensor-data/latest-by-machine', asyncHandler(async (req, res) => {
  const machineId = req.params.machineId || 'CMP-001';
  const reading = await SensorReading.findOne({ machine: machineId })
    .sort({ date: -1 })
    .lean() as ISensorReading | null;
  res.json(reading ? singleReadingSchema.parse(reading) : null);
}));

route.get('/sensor-data/history', asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
  const readings = await SensorReading.find({ machine: defaultMachineId })
    .sort({ date: -1 })
    .limit(limit)
    .lean() as unknown as ISensorReading[];
  res.json(readings.map(r => singleReadingSchema.parse(r)));
}));

route.get('/sensor-data/stream', asyncHandler(async (_req, res) => {
  // DEPRECATED: Use /sensor-data/historical with range parameter instead.
  // This endpoint is kept for backward compatibility only.
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', '</sensor-data/historical?range=24h>; rel="deprecation"');
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

// Historical sensor readings with time-range filtering
route.get('/sensor-data/historical', asyncHandler(async (req, res) => {
  const range = (req.query.range as HistoricalRange | undefined) ?? '24h';
  const startDate = getRangeStart(range);
  const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 5000);

  const query: any = { machine: defaultMachineId };
  if (startDate) {
    query.date = { $gte: startDate };
  }

  const readings = await SensorReading.find(query)
    .sort({ date: -1 })
    .limit(limit)
    .lean() as unknown as ISensorReading[];

  res.json({
    range,
    startDate,
    count: readings.length,
    readings: readings.map(r => singleReadingSchema.parse(r)),
  });
}));

route.post('/sensor-data/batch', requireAuth, validateBody(batchReadingSchema), asyncHandler(async (req, res) => {
  const body = req.body;
  const readings: Array<{
    temperature: number;
    vibration: number;
    operatingHours?: number;
    timestamp?: number; // Unix epoch milliseconds
    source?: string;
  }> = Array.isArray(body.readings) ? body.readings : [body];
  
  const machine = defaultMachineId;

  const results = await Promise.allSettled(
    readings.map(async (item) => {
      const reading = new SensorReading({
        machine,
        temperature: item.temperature,
        vibration: item.vibration,
        operatingHours: item.operatingHours ?? 0,
        date: item.timestamp ?? Date.now(),
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
  const machine = defaultMachineId;
  const reading = new SensorReading({
    temperature: body.temperature ?? 0,
    vibration: body.vibration ?? 0,
    operatingHours: body.operatingHours ?? 0,
    date: body.date ?? Date.now(),
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
  humidity: z.number().min(0).max(100).optional(),
  timestamp: z.number().optional(), // Unix epoch milliseconds
  operatingHours: z.number().min(0).optional(),
  source: z.string().optional()
});

route.post('/devices/readings', deviceIngestLimiter, requireDeviceKey, validateBody(deviceReadingSchema), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof deviceReadingSchema>;
  const machine = defaultMachineId;

  const reading = new SensorReading({
    machine,
    temperature: body.temperature,
    vibration: body.vibration,
    humidity: body.humidity,
    operatingHours: body.operatingHours ?? 0,
    date: body.timestamp ?? Date.now(),
    source: body.source || 'device',
    syncedToFirebase: true // optimistic; set to false below if Firebase push fails
  });
  await reading.save();

  // --- State-aware anomaly gating (start/stop suspend detection) ---
  const stateEntry = await MachineState.findOne({ machine })
    .sort({ changedAt: -1 })
    .lean() as { state?: string } | null;
  // Fail-open default: a machine with no state entries yet behaves exactly as
  // today - only actively tracked machines are suspended.
  const effectiveState = stateEntry?.state ?? 'operating';

  // detection is inferred from the real AnomalyDetector.analyze() return type
  // (parameter/severity/score/trendSlope may be set or undefined) - the
  // hand-written narrow type above was fighting the ML output.
  let detection: any = null;

  if (effectiveState === 'operating') {
    // The rolling z-score baseline resets at the most recent 'operating'
    // transition - pre-startup and stopped readings never pollute it.
    const operatingEntry = await MachineState.findOne({ machine, state: 'operating' })
      .sort({ changedAt: -1 })
      .lean() as { changedAt: number } | null;
    const historyQuery: Record<string, unknown> = { machine };
    if (operatingEntry) {
      historyQuery.date = { $gte: operatingEntry.changedAt };
    }
    const history = await SensorReading.find(historyQuery)
      .sort({ date: -1 })
      .limit(21)
      .lean() as unknown as ISensorReading[];
    const detector = new AnomalyDetector();
    detection = detector.analyze(reading as ISensorReading, history as ISensorReading[], DEFAULT_THRESHOLDS);
  }

  // If anomaly detected, persist alert with duplicate suppression
  if (effectiveState === 'operating' && detection?.anomaly) {
    const { message, recommendation } = getRecommendationForDetection(
      detection.parameter ?? null,
      detection.severity,
      detection.trendDirection ?? 'stable'
    );

    const alert = new Alert({
      machine,
      parameter: detection.parameter ?? null,
      zScore: detection.score ?? null,
      trendDirection: detection.trendDirection ?? null,
      severity: detection.severity,
      message: message || detection.reason || 'Sensor anomaly detected.',
      recommendation: recommendation || detection.suggestion || 'Review sensor readings and machine condition — consult maintenance procedures.',
      triggeredAt: reading.date,
      resolved: false
    });

    try {
      await alert.save();

      // Push alert to Firebase immediately for near-real-time delivery
      if (db) {
        try {
          await db.ref("alerts").push({
            machine,
            parameter: detection.parameter,
            severity: detection.severity,
            message: message || detection.reason || 'Sensor anomaly detected.',
            recommendation: recommendation || detection.suggestion || 'Review sensor readings and machine condition — consult maintenance procedures.',
            timestamp: reading.date,
            source: "device"
          });
        } catch (error) {
          console.error("[device-ingest] Firebase alert push failed:", error instanceof Error ? error.message : error);
        }
      }
    } catch (error: any) {
      // E11000 = duplicate key from partial unique index → alert was suppressed
      if (error.code === 11000) {
        console.log("[device-ingest] Duplicate alert suppressed (partial unique index):", error.message);
      } else {
        throw error;
      }
    }
  }

  let firebasePushOk = false;
  if (db) {
    try {
      await db.ref("sensorReadings").push({
        temperature: reading.temperature,
        vibration: reading.vibration,
        timestamp: reading.date, // Unix epoch milliseconds
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
    syncedToFirebase: firebasePushOk,
    machineState: effectiveState,
    anomaly: (effectiveState === 'operating' && detection?.anomaly) ? {
      severity: detection.severity,
      parameter: detection.parameter,
      reason: detection.reason,
      recommendation: detection.reason, // same value stored as Alert.recommendation
      score: detection.score,
      trendDirection: detection.trendDirection
    } : null
  });
}));

export default route;

