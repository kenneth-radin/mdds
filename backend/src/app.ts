import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import machineRoutes from './routes/machine.routes';
import recordRoutes from './routes/record.routes';
import sensorRoutes from './routes/sensor.routes';
import machineStateRoutes from './routes/machineState.routes';
import caseRoutes from './routes/case.routes';
import caseReviewRoutes from './routes/caseReview.routes';
import testingRoutes from './routes/testing.routes';
import reportRoutes from './routes/report.routes';
import mlRoutes from './routes/ml.routes';
import { errorHandler, notFound } from './middleware/error';
import { hydrateFromDisk, listCards } from './services/ml/modelRegistry';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

export function createApp() {
  const app = express();

  // CORS: allow only the configured web origins (Vercel + localhost dev).
  // Requests with no Origin header (native mobile apps, curl, server-to-server)
  // are always allowed so the ESP32 / mobile app keep working.
  // A literal '*' in the allowlist is treated as "allow all" so a stale
  // CORS_ORIGIN=* from an older deploy keeps working rather than blocking
  // every origin.
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // no Origin = native/curl
        if (env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  // Load persisted model weights/cards written by `npm run train:ml`.
  const loadedModels = hydrateFromDisk();
  console.log(`[ml] ${loadedModels} model card(s) loaded, ${listCards().length} available`);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      models: listCards().length,
      time: new Date().toISOString()
    });







  });

  app.use('/api', authRoutes);
  app.use('/api', sensorRoutes);
  app.use('/api', machineStateRoutes);
  app.use('/api', machineRoutes);
  app.use('/api', recordRoutes);
  app.use('/api', caseRoutes);
  app.use('/api', caseReviewRoutes);
  app.use('/api', testingRoutes);
  app.use('/api', reportRoutes);
  app.use('/api', mlRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
