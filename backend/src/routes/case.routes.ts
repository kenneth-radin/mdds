import { Router } from 'express';
import { z } from 'zod';
import { MaintenanceCase } from '../models/MaintenanceCase';
import { asyncHandler, HttpError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { buildCaseNumber, resolveMachine } from '../utils/helpers';
import { loadMachineHistory } from '../services/historyService';
import { analyzeMaintenanceCase } from '../services/analysisService';

const router = Router();
router.use(requireAuth);

const analyzeSchema = z.object({
  machine: z.string().min(1),
  currentProblem: z.string().min(3),
  symptoms: z.array(z.string()).optional(),
  operatingHoursAtReport: z.number().nullable().optional(),
  lastMaintenanceDate: z.string().datetime().nullable().optional(),
  urgency: z.enum(['low', 'medium', 'high']).optional()
});

const emptyReview = () => ({
  decision: null,
  modifiedSuggestion: '',
  reviewerNote: '',
  reviewedBy: null,
  reviewedAt: null
});
const emptyAction = () => ({
  performedOn: null,
  actionTaken: '',
  partsReplaced: [],
  downtimeHours: null,
  technician: '',
  notes: ''
});
const emptyOutcome = () => ({
  result: null,
  productionLossUnits: null,
  cost: null,
  notes: '',
  recordedAt: null
});

export async function runAnalysisForCase(maintenanceCase: InstanceType<typeof MaintenanceCase>) {
  const machine = await resolveMachine(String(maintenanceCase.machine));
  const history = await loadMachineHistory(machine);
  return analyzeMaintenanceCase(machine, history, {
    currentProblem: maintenanceCase.currentProblem,
    symptoms: maintenanceCase.symptoms,
    operatingHoursAtReport: maintenanceCase.operatingHoursAtReport ?? null,
    lastMaintenanceDate: maintenanceCase.lastMaintenanceDate ?? null,
    hoursSinceLastMaintenance: maintenanceCase.hoursSinceLastMaintenance ?? null,
    urgency: maintenanceCase.urgency
  });
}

router.post(
  '/analysis/maintenance-case',
  validateBody(analyzeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof analyzeSchema>;
    const machine = await resolveMachine(body.machine);
    const history = await loadMachineHistory(machine);

    const lastMaintenanceDate = body.lastMaintenanceDate
      ? new Date(body.lastMaintenanceDate)
      : machine.lastMaintenanceDate || null;
    const hoursSinceLastMaintenance = lastMaintenanceDate
      ? Math.max(0, Math.round(((Date.now() - lastMaintenanceDate.getTime()) / 3600000) * 100) / 100)
      : null;

    const result = analyzeMaintenanceCase(machine, history, {
      currentProblem: body.currentProblem,
      symptoms: body.symptoms || [],
      operatingHoursAtReport: body.operatingHoursAtReport ?? null,
      lastMaintenanceDate,
      hoursSinceLastMaintenance,
      urgency: body.urgency || 'medium'
    });

    const total = await MaintenanceCase.countDocuments({});
    const maintenanceCase = await MaintenanceCase.create({
      caseNumber: buildCaseNumber(total + 1),
      machine: machine._id,
      reportedBy: req.auth!.userId,
      currentProblem: body.currentProblem,
      symptoms: body.symptoms || [],
      operatingHoursAtReport: body.operatingHoursAtReport ?? null,
      lastMaintenanceDate,
      hoursSinceLastMaintenance,
      urgency: body.urgency || 'medium',
      status: result.sufficientData ? 'analyzed' : 'draft',
      analysis: {
        generatedAt: result.generatedAt,
        sufficientData: result.sufficientData,
        message: result.message,
        missingData: result.missingData,
        dataUsed: result.dataUsed,
        statistics: result.statistics,
        suggestions: result.suggestions as never
      },
      review: emptyReview(),
      actualAction: emptyAction(),
      outcome: emptyOutcome(),
      linkedMaintenanceRecord: null
    });

    res.status(201).json({ maintenanceCase, comparableRecords: result.comparableRecords });
  })
);

router.get(
  '/maintenance-cases',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (req.query.machine) {
      const machine = await resolveMachine(String(req.query.machine));
      filter.machine = machine._id;
    }
    if (req.query.status) filter.status = String(req.query.status);
    const cases = await MaintenanceCase.find(filter)
      .populate('machine', 'machineId name machineType location')
      .sort({ dateReported: -1 })
      .lean();
    res.json({ cases, count: cases.length });
  })
);

router.get(
  '/maintenance-cases/:id',
  asyncHandler(async (req, res) => {
    const maintenanceCase = await MaintenanceCase.findById(req.params.id)
      .populate('machine')
      .populate('reportedBy', 'name role title');
    if (!maintenanceCase) throw new HttpError(404, 'Maintenance case not found.');
    res.json({ maintenanceCase });
  })
);

export default router;
