import { Router } from 'express';
import { z } from 'zod';
import { MaintenanceCase } from '../models/MaintenanceCase';
import { MaintenanceRecord } from '../models/MaintenanceRecord';
import { asyncHandler, HttpError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { resolveMachine } from '../utils/helpers';
import { runAnalysisForCase } from './case.routes';

const router = Router();
router.use(requireAuth);

const reviewSchema = z.object({
  decision: z.enum(['accepted', 'modified', 'rejected']),
  modifiedSuggestion: z.string().optional(),
  reviewerNote: z.string().optional()
});

const outcomeSchema = z.object({
  result: z.enum(['resolved', 'partially-resolved', 'not-resolved']),
  actionTaken: z.string().min(1),
  partsReplaced: z.array(z.string()).optional(),
  downtimeHours: z.number().min(0).nullable().optional(),
  technician: z.string().optional(),
  performedOn: z.string().datetime().nullable().optional(),
  productionLossUnits: z.number().nullable().optional(),
  cost: z.number().nullable().optional(),
  notes: z.string().optional()
});

async function findCase(id: string) {
  const maintenanceCase = await MaintenanceCase.findById(id);
  if (!maintenanceCase) throw new HttpError(404, 'Maintenance case not found.');
  return maintenanceCase;
}

router.post(
  '/maintenance-cases/:id/analyze',
  asyncHandler(async (req, res) => {
    const maintenanceCase = await findCase(String(req.params.id));
    const result = await runAnalysisForCase(maintenanceCase);
    maintenanceCase.analysis = {
      generatedAt: result.generatedAt,
      sufficientData: result.sufficientData,
      message: result.message,
      missingData: result.missingData,
      dataUsed: result.dataUsed,
      statistics: result.statistics,
      suggestions: result.suggestions as never
    };
    maintenanceCase.status = result.sufficientData ? 'analyzed' : 'draft';
    await maintenanceCase.save();
    res.json({ maintenanceCase, comparableRecords: result.comparableRecords });
  })
);

router.put(
  '/maintenance-cases/:id/review',
  validateBody(reviewSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof reviewSchema>;
    const maintenanceCase = await findCase(String(req.params.id));
    maintenanceCase.review = {
      decision: body.decision,
      modifiedSuggestion: body.modifiedSuggestion || '',
      reviewerNote: body.reviewerNote || '',
      reviewedBy: req.auth!.userId as never,
      reviewedAt: new Date()
    };
    if (maintenanceCase.status === 'analyzed') maintenanceCase.status = 'reviewed';
    await maintenanceCase.save();
    res.json({ maintenanceCase });
  })
);

router.put(
  '/maintenance-cases/:id/outcome',
  validateBody(outcomeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof outcomeSchema>;
    const maintenanceCase = await findCase(String(req.params.id));
    const machine = await resolveMachine(String(maintenanceCase.machine));

    const performedOn = body.performedOn ? new Date(body.performedOn) : new Date();
    const parts = body.partsReplaced || [];

    maintenanceCase.actualAction = {
      performedOn,
      actionTaken: body.actionTaken,
      partsReplaced: parts,
      downtimeHours: body.downtimeHours ?? null,
      technician: body.technician || '',
      notes: body.notes || ''
    };
    maintenanceCase.outcome = {
      result: body.result,
      productionLossUnits: body.productionLossUnits ?? null,
      cost: body.cost ?? null,
      notes: body.notes || '',
      recordedAt: new Date()
    };

    const record = await MaintenanceRecord.create({
      machine: machine._id,
      date: performedOn,
      maintenanceType: 'corrective',
      problem: maintenanceCase.currentProblem,
      action: body.actionTaken,
      partsReplaced: parts,
      technician: body.technician || '',
      downtimeHours: body.downtimeHours ?? 0,
      cost: body.cost ?? null,
      productionLossUnits: body.productionLossUnits ?? null,
      status: 'completed',
      result: body.result,
      notes: body.notes || '',
      createdBy: req.auth!.userId
    });

    maintenanceCase.linkedMaintenanceRecord = record._id;
    maintenanceCase.status = 'completed';
    await maintenanceCase.save();

    machine.lastMaintenanceDate = performedOn;
    await machine.save();

    res.json({ maintenanceCase, maintenanceRecord: record });
  })
);

export default router;
