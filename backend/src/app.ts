import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import machineRoutes from './routes/machine.routes';
import recordRoutes from './routes/record.routes';
import caseRoutes from './routes/case.routes';
import caseReviewRoutes from './routes/caseReview.routes';
import testingRoutes from './routes/testing.routes';
import reportRoutes from './routes/report.routes';
import mlRoutes from './routes/ml.routes';
import { errorHandler, notFound } from './middleware/error';
import { hydrateFromDisk, listCards } from './services/ml/modelRegistry';
import mongoose from 'mongoose';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',') }));
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
