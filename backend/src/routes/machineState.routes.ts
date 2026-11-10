/**
 * Machine state flagging for personnel.
 *
 * Append-only state log: every { starting, operating, stopped } transition is a
 * new document. Routes here are deliberately unauthenticated (used by mobile
 * personnel with no JWT today) and ingest only the machine code string - no
 * foreign-key validation against the Machine collection, consistent with the
 * sensor ingestion path.
 *
 * Auth boundary: do NOT move this router under requireAuth without revisiting
 * the mobile auth story; these endpoints are the device/personnel write path
 * only.
 */
import { Router } from 'express';
import { z } from 'zod';
import { MachineState } from '../models/MachineState';
import { validateBody } from '../middleware/validate';
import { asyncHandler, HttpError } from '../middleware/error';

const router = Router();

const stateSchema = z.object({
  state: z.enum(['starting', 'operating', 'stopped']),
  changedBy: z.string().max(100).trim().optional(),
  changedAt: z.number().int().positive().optional(), // server default: Date.now()
});

// .../state  - latest state (+ ageMs for the "in starting > 10 min" reminder)
router.get(
  '/machines/:machineId/state',
  asyncHandler(async (req, res) => {
    const machineId = String(req.params.machineId);
    const current = await MachineState.findOne({ machine: machineId })
      .sort({ changedAt: -1 })
      .lean();
    res.json({
      machine: machineId,
      current: current
        ? {
            state: current.state,
            changedAt: current.changedAt,
            changedBy: current.changedBy,
            ageMs: Date.now() - current.changedAt,
          }
        : null,
    });
  })
);

// .../state/history - ascending (chart-order) transition history, optional range
router.get(
  '/machines/:machineId/state/history',
  asyncHandler(async (req, res) => {
    const machineId = String(req.params.machineId);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const from = typeof req.query.from === 'string' ? Number(req.query.from) : undefined;
    const to = typeof req.query.to === 'string' ? Number(req.query.to) : undefined;
    const filter: Record<string, unknown> = { machine: machineId };
    if (from !== undefined) {
      filter.changedAt = filter.changedAt ? { ...filter.changedAt, $gte: from } : { $gte: from };
    }
    if (to !== undefined) {
      filter.changedAt = filter.changedAt ? { ...filter.changedAt, $lte: to } : { $lte: to };
    }
    const history = await MachineState.find(filter)
      .sort({ changedAt: 1 })
      .limit(limit)
      .lean();
    res.json({ machine: machineId, history: history as any[], count: history.length });
  })
);

// .../state  - create a new log entry (dedupe: skip if the machine is already
//              in the requested state - repeated taps return deduplicated:true)
router.post(
  '/machines/:machineId/state',
  validateBody(stateSchema),
  asyncHandler(async (req, res) => {
    const machineId = String(req.params.machineId);
    const body = req.body as z.infer<typeof stateSchema>;

    // Dedupe: one log entry per state transition; holding the same button
    // recomputes the same transition without creating a duplicate row.
    const latest = await MachineState.findOne({ machine: machineId })
      .sort({ changedAt: -1 })
      .lean();
    if (latest && latest.state === body.state) {
      const entry = latest as any;
      return res.json({
        stateLog: entry,
        deduplicated: true,
        message: 'Already in state "' + entry.state + '".',
      });
    }

    const stateLog = await MachineState.create({
      machine: machineId,
      state: body.state,
      changedAt: body.changedAt ?? Date.now(),
      changedBy: body.changedBy ?? null,
    });
    res.status(201).json({ stateLog: stateLog as any });
  })
);

export default router;
