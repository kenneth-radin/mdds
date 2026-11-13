import { Router } from 'express';
import { z } from 'zod';
import { Alert } from '../models/Alert';
import { MaintenanceCase } from '../models/MaintenanceCase';
import { FailureRecord } from '../models/FailureRecord';
import { asyncHandler, HttpError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

const resolveSchema = z.object({});

const summarySchema = z.object({});

router.get(
  '/alerts',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (req.query.resolved !== undefined) {
      filter.resolved = req.query.resolved === 'true';
    }
    if (req.query.severity) {
      filter.severity = req.query.severity;
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .sort({ triggeredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Alert.countDocuments(filter),
    ]);

    res.json({
      alerts: alerts.map((a) => ({
        ...a,
        seeded: !!a.seedTag,
      })),
      total,
      page,
      limit,
    });
  })
);

router.get(
  '/alerts/summary',
  asyncHandler(async (_req, res) => {
    const openCount = await Alert.countDocuments({ resolved: false });
    const latestAlert = await Alert.findOne({})
      .sort({ triggeredAt: -1 })
      .lean();

    const bySeverity = await Alert.aggregate([
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]);

    res.json({
      openCount,
      latestAlert: latestAlert
        ? { ...latestAlert, seeded: !!latestAlert.seedTag }
        : null,
      bySeverity: bySeverity.reduce(
        (acc, r) => {
          acc[r._id as string] = r.count;
          return acc;
        },
        {} as Record<string, number>
      ),
    });
  })
);

router.get(
  '/alerts/:id',
  asyncHandler(async (req, res) => {
    const alert = await Alert.findById(req.params.id).lean();
    if (!alert) throw new HttpError(404, 'Alert not found.');

    const linkedCase = alert.linkedMaintenanceCase
      ? await MaintenanceCase.findById(alert.linkedMaintenanceCase)
          .populate('machine', 'machineId name machineType location')
          .lean()
      : null;

    const linkedFailure = alert.linkedFailureRecord
      ? await FailureRecord.findById(alert.linkedFailureRecord).lean()
      : null;

    const caseAccuracy = (c: { proposedActions?: Array<{ correct: boolean }> } | null) => {
      if (!c || !c.proposedActions || c.proposedActions.length === 0) return null;
      const correct = c.proposedActions.filter((a) => a.correct === true).length;
      return correct / c.proposedActions.length;
    };

    const typedLinkedCase = linkedCase as { proposedActions?: Array<{ correct: boolean }>; seedTag?: string } | null;

    res.json({
      alert: { ...alert, seeded: !!alert.seedTag },
      linkedMaintenanceCase: linkedCase
        ? {
            ...linkedCase,
            accuracy: caseAccuracy(typedLinkedCase),
            seeded: !!(typedLinkedCase?.seedTag),
          }
        : null,
      linkedFailureRecord: linkedFailure
        ? { ...linkedFailure, seeded: !!linkedFailure.seedTag }
        : null,
    });
  })
);

router.get(
  '/alerts/accuracy-summary',
  asyncHandler(async (_req, res) => {
    const [seeded, real] = await Promise.all([
      MaintenanceCase.find({
        seedTag: { $exists: true },
        proposedActions: { $exists: true, $ne: [], $size: { $gt: 0 } },
      }).lean(),
      MaintenanceCase.find({
        seedTag: { $exists: false },
        proposedActions: { $exists: true, $ne: [], $size: { $gt: 0 } },
      }).lean(),
    ]);

    const compute = (cases: Array<{ proposedActions: Array<{ correct: boolean }> }>) => {
      const casesCounted = cases.length;
      const correct = cases.reduce(
        (sum, c) => sum + c.proposedActions.filter((a) => a.correct === true).length,
        0
      );
      const total = cases.reduce((sum, c) => sum + c.proposedActions.length, 0);
      const accuracy = total === 0 ? null : correct / total;
      return { casesCounted, correct, total, accuracy };
    };

    res.json({
      seeded: compute(seeded as any),
      real: compute(real as any),
    });
  })
);

router.patch(
  '/alerts/:id/resolve',
  validateBody(resolveSchema),
  asyncHandler(async (req, res) => {
    const alert = await Alert.findById(req.params.id);
    if (!alert) throw new HttpError(404, 'Alert not found.');
    alert.resolved = true;
    alert.resolvedAt = Date.now();
    await alert.save();
    res.json({ alert });
  })
);

export default router;