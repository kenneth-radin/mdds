import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { buildSummaryReport } from '../services/reportService';

const router = Router();
router.use(requireAuth);

router.get(
  '/reports/summary',
  asyncHandler(async (_req, res) => {
    res.json(await buildSummaryReport());
  })
);

export default router;
