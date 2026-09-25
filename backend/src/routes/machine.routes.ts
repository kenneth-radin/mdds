import { Router } from 'express';
import { z } from 'zod';
import { Machine } from '../models/Machine';
import { MaintenanceRecord } from '../models/MaintenanceRecord';
import { FailureRecord } from '../models/FailureRecord';
import { MaintenanceCase } from '../models/MaintenanceCase';
import { OperationalData } from '../models/OperationalData';
import { asyncHandler, HttpError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { resolveMachine } from '../utils/helpers';

const router = Router();
router.use(requireAuth);

const machineSchema = z.object({
  machineId: z.string().min(1),
  name: z.string().min(1),
  machineType: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  location: z.string().optional(),
  criticality: z.enum(['low', 'medium', 'high']).optional(),
  installationDate: z.string().datetime().nullable().optional(),
  ratedPowerKw: z.number().nullable().optional(),
  ratedVoltage: z.number().nullable().optional(),
  ratedCurrent: z.number().nullable().optional(),
  designSpeedRpm: z.number().nullable().optional(),
  operatingHours: z.number().min(0).optional(),
  lastMaintenanceDate: z.string().datetime().nullable().optional(),
  notes: z.string().optional()
});

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

router.get(
  '/machines',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || '').trim();
    const filter = search
      ? {
          $or: [
            { machineId: new RegExp(search, 'i') },
            { name: new RegExp(search, 'i') },
            { machineType: new RegExp(search, 'i') },
            { location: new RegExp(search, 'i') }
          ]
        }
      : {};
    const machines = await Machine.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ machines, count: machines.length });
  })
);

router.post(
  '/machines',
  validateBody(machineSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof machineSchema>;
    const exists = await Machine.findOne({ machineId: body.machineId.trim() });
    if (exists) throw new HttpError(409, 'A machine with that machine ID already exists.');
    const machine = await Machine.create({
      ...body,
      installationDate: toDate(body.installationDate),
      lastMaintenanceDate: toDate(body.lastMaintenanceDate),
      createdBy: req.auth!.userId
    });
    res.status(201).json({ machine });
  })
);

router.get(
  '/machines/:id',
  asyncHandler(async (req, res) => {
    const machine = await resolveMachine(String(req.params.id));
    res.json({ machine });
  })
);

router.put(
  '/machines/:id',
  validateBody(machineSchema.partial()),
  asyncHandler(async (req, res) => {
    const machine = await resolveMachine(String(req.params.id));
    const body = req.body as Partial<z.infer<typeof machineSchema>>;
    Object.assign(machine, {
      ...body,
      installationDate: body.installationDate === undefined ? machine.installationDate : toDate(body.installationDate),
      lastMaintenanceDate: body.lastMaintenanceDate === undefined ? machine.lastMaintenanceDate : toDate(body.lastMaintenanceDate)
    });
    await machine.save();
    res.json({ machine });
  })
);

router.delete(
  '/machines/:id',
  asyncHandler(async (req, res) => {
    const machine = await resolveMachine(String(req.params.id));
    await Promise.all([
      MaintenanceRecord.deleteMany({ machine: machine._id }),
      FailureRecord.deleteMany({ machine: machine._id }),
      OperationalData.deleteMany({ machine: machine._id }),
      MaintenanceCase.deleteMany({ machine: machine._id }),
      machine.deleteOne()
    ]);
    res.json({ deleted: true });
  })
);

router.get(
  '/machines/:id/summary',
  asyncHandler(async (req, res) => {
    const machine = await resolveMachine(String(req.params.id));
    const [maintenanceRecords, failureRecords, operationalRecords, cases] = await Promise.all([
      MaintenanceRecord.countDocuments({ machine: machine._id }),
      FailureRecord.countDocuments({ machine: machine._id }),
      OperationalData.countDocuments({ machine: machine._id }),
      MaintenanceCase.countDocuments({ machine: machine._id })
    ]);
    res.json({
      machine,
      counts: { maintenanceRecords, failureRecords, operationalRecords, cases }
    });
  })
);

export default router;
