import { Router } from 'express';
import { z } from 'zod';
import { TestingCase } from '../models/TestingCase';
import { asyncHandler } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { round, resolveMachine } from '../utils/helpers';
import { textSimilarity } from '../services/ml/tfidf';

const router = Router();
router.use(requireAuth);

const testingSchema = z.object({
  machine: z.string().min(1),
  maintenanceCase: z.string().nullable().optional(),
  description: z.string().min(1),
  expectedSuggestion: z.string().min(1),
  actualSuggestion: z.string().min(1),
  matchScore: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().optional()
});

router.get(
  '/testing/cases',
  asyncHandler(async (_req, res) => {
    const cases = await TestingCase.find({})
      .populate('machine', 'machineId name machineType')
      .sort({ createdAt: -1 })
      .lean();
    const matched = cases.filter((c) => c.matched).length;
    res.json({
      cases,
      count: cases.length,
      summary: {
        total: cases.length,
        matched,
        matchRate: cases.length > 0 ? round((matched / cases.length) * 100, 1) : null
      }
    });
  })
);

router.post(
  '/testing/cases',
  validateBody(testingSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof testingSchema>;
    const machine = await resolveMachine(body.machine);

    // Match score is computed from the actually compared text when the researcher
    // does not supply one. It uses the same TF-IDF cosine method as Layer 1 so the
    // whole system scores text identically, and the value is never fabricated.
    const similarity = textSimilarity(body.expectedSuggestion, body.actualSuggestion);
    const matchScore = body.matchScore ?? round(similarity * 100, 1);

    const record = await TestingCase.create({
      machine: machine._id,
      maintenanceCase: body.maintenanceCase || null,
      description: body.description,
      expectedSuggestion: body.expectedSuggestion,
      actualSuggestion: body.actualSuggestion,
      matched: matchScore >= 50,
      matchScore,
      notes: body.notes || '',
      createdBy: req.auth!.userId
    });

    res.status(201).json({ record });
  })
);

export default router;
