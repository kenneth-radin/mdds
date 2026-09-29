import { Router } from 'express';
import { z } from 'zod';
import { MaintenanceRecord } from '../models/MaintenanceRecord';
import { FailureRecord } from '../models/FailureRecord';
import { OperationalData } from '../models/OperationalData';
import { Machine } from '../models/Machine';
import { MaintenanceCase } from '../models/MaintenanceCase';
import { asyncHandler, HttpError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { resolveMachine } from '../utils/helpers';
import { dateString } from '../utils/dateSchema';

const router = Router();
router.use(requireAuth);

const machineRef = z.string().min(1);

const maintenanceSchema = z.object({
  machine: machineRef,
  date: dateString,
  maintenanceType: z.enum(['preventive', 'corrective', 'predictive', 'inspection', 'overhaul']),
  problem: z.string().min(1),
  action: z.string().min(1),
  partsReplaced: z.array(z.string()).optional(),
  technician: z.string().optional(),
  startTime: dateString.nullable().optional(),
  endTime: dateString.nullable().optional(),
  downtimeHours: z.number().min(0).optional(),
  cost: z.number().nullable().optional(),
  productionLossUnits: z.number().nullable().optional(),
  energyKwh: z.number().nullable().optional(),
  status: z.string().optional(),
  result: z.string().optional(),
  notes: z.string().optional()
});

const failureSchema = z.object({
  machine: machineRef,
  date: dateString,
  failureMode: z.string().min(1),
  cause: z.string().optional(),
  symptoms: z.array(z.string()).optional(),
  severity: z.enum(['minor', 'moderate', 'major', 'critical']),
  downtimeHours: z.number().min(0).optional(),
  correctiveAction: z.string().optional(),
  notes: z.string().optional()
});

const operationalSchema = z.object({
  machine: machineRef,
  date: dateString,
  operatingHours: z.number().min(0).optional(),
  productionOutput: z.number().nullable().optional(),
  downtimeHours: z.number().min(0).optional(),
  energyKwh: z.number().nullable().optional(),
  notes: z.string().optional()
});

router.post(
  '/maintenance',
  validateBody(maintenanceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof maintenanceSchema>;
    const machine = await resolveMachine(body.machine);
    const record = await MaintenanceRecord.create({
      ...body,
      machine: machine._id,
      date: new Date(body.date),
      startTime: body.startTime ? new Date(body.startTime) : null,
      endTime: body.endTime ? new Date(body.endTime) : null,
      createdBy: req.auth!.userId
    });
    if (new Date(body.date) >= new Date(machine.lastMaintenanceDate || 0)) {
      machine.lastMaintenanceDate = new Date(body.date);
      await machine.save();
    }
    res.status(201).json({ record });
  })
);

router.get(
  '/machines/:id/maintenance',
  asyncHandler(async (req, res) => {
    const machine = await resolveMachine(String(req.params.id));
    const records = await MaintenanceRecord.find({ machine: machine._id }).sort({ date: -1 }).lean();
    res.json({ records, count: records.length });
  })
);

router.get(
  '/maintenance/:id',
  asyncHandler(async (req, res) => {
    const record = await MaintenanceRecord.findById(req.params.id);
    if (!record) throw new HttpError(404, 'Maintenance record not found.');
    res.json({ record });
  })
);

router.put(
  '/maintenance/:id',
  validateBody(maintenanceSchema.partial()),
  asyncHandler(async (req, res) => {
    const record = await MaintenanceRecord.findById(req.params.id);
    if (!record) throw new HttpError(404, 'Maintenance record not found.');
    const body = req.body as Partial<z.infer<typeof maintenanceSchema>>;
    if (body.date) record.date = new Date(body.date);
    Object.assign(record, { ...body, date: record.date });
    await record.save();
    res.json({ record });
  })
);

router.post(
  '/failures',
  validateBody(failureSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof failureSchema>;
    const machine = await resolveMachine(body.machine);
    const record = await FailureRecord.create({
      ...body,
      machine: machine._id,
      date: new Date(body.date),
      createdBy: req.auth!.userId
    });
    res.status(201).json({ record });
  })
);

router.get(
  '/machines/:id/failures',
  asyncHandler(async (req, res) => {
    const machine = await resolveMachine(String(req.params.id));
    const records = await FailureRecord.find({ machine: machine._id }).sort({ date: -1 }).lean();
    res.json({ records, count: records.length });
  })
);

router.post(
  '/operational-data',
  validateBody(operationalSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof operationalSchema>;
    const machine = await resolveMachine(body.machine);
    const record = await OperationalData.create({
      ...body,
      machine: machine._id,
      date: new Date(body.date),
      createdBy: req.auth!.userId
    });
    if (typeof body.operatingHours === 'number') {
      await Machine.updateOne({ _id: machine._id }, { $set: { operatingHours: body.operatingHours } });
    }
    res.status(201).json({ record });
  })
);

router.get(
  '/machines/:id/operational-data',
  asyncHandler(async (req, res) => {
    const machine = await resolveMachine(String(req.params.id));
    const records = await OperationalData.find({ machine: machine._id }).sort({ date: -1 }).lean();
    res.json({ records, count: records.length });
  })
);

// ---------------------------------------------------------------------------
// Update / delete for the historical record collections.
//
// §12 and §13 require that historical maintenance and failure records can be
// edited and removed, not only created. Before this, the API exposed POST/GET
// only, so a typo in a historical record was permanent and the UI had no way to
// offer an edit or delete action.
// ---------------------------------------------------------------------------

router.put(
  '/failures/:id',
  validateBody(failureSchema.partial()),
  asyncHandler(async (req, res) => {
    const record = await FailureRecord.findById(req.params.id);
    if (!record) throw new HttpError(404, 'Failure record not found.');

    const body = req.body as Partial<z.infer<typeof failureSchema>>;
    if (body.machine) {
      const machine = await resolveMachine(body.machine);
      record.machine = machine._id;
    }
    if (body.date) record.date = new Date(body.date);
    Object.assign(record, body, { date: record.date, machine: record.machine });
    await record.save();
    res.json({ record });
  })
);

router.delete(
  '/failures/:id',
  asyncHandler(async (req, res) => {
    const record = await FailureRecord.findByIdAndDelete(req.params.id);
    if (!record) throw new HttpError(404, 'Failure record not found.');
    res.json({ deleted: true });
  })
);

router.put(
  '/operational-data/:id',
  validateBody(operationalSchema.partial()),
  asyncHandler(async (req, res) => {
    const record = await OperationalData.findById(req.params.id);
    if (!record) throw new HttpError(404, 'Operational record not found.');

    const body = req.body as Partial<z.infer<typeof operationalSchema>>;
    if (body.machine) {
      const machine = await resolveMachine(body.machine);
      record.machine = machine._id;
    }
    if (body.date) record.date = new Date(body.date);
    Object.assign(record, body, { date: record.date, machine: record.machine });
    await record.save();

    // POST mirrors new operating hours onto the machine; PUT must too, or the
    // machine profile silently disagrees with its own operational history.
    if (typeof body.operatingHours === 'number') {
      await Machine.updateOne({ _id: record.machine }, { $set: { operatingHours: body.operatingHours } });
    }
    res.json({ record });
  })
);

router.delete(
  '/operational-data/:id',
  asyncHandler(async (req, res) => {
    const record = await OperationalData.findByIdAndDelete(req.params.id);
    if (!record) throw new HttpError(404, 'Operational record not found.');
    res.json({ deleted: true });
  })
);

router.delete(
  '/maintenance/:id',
  asyncHandler(async (req, res) => {
    const record = await MaintenanceRecord.findById(req.params.id);
    if (!record) throw new HttpError(404, 'Maintenance record not found.');

    const machineId = record.machine;

    // A completed case may point at this record; drop the link rather than
    // leave it dangling at a document that no longer exists.
    await MaintenanceCase.updateOne(
      { linkedMaintenanceRecord: record._id },
      { $set: { linkedMaintenanceRecord: null } }
    );

    await record.deleteOne();

    // If this was the newest record, machine.lastMaintenanceDate would otherwise
    // keep pointing at a deleted row. Recompute it from what remains.
    const machine = await Machine.findById(machineId);
    if (machine) {
      const [latest] = await MaintenanceRecord.find({ machine: machine._id })
        .sort({ date: -1 })
        .limit(1)
        .lean();
      machine.lastMaintenanceDate = latest ? (latest.date as Date) : null;
      await machine.save();
    }

    res.json({ deleted: true });
  })
);

export default router;
