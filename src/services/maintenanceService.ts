import { MaintenanceRecord, Equipment } from '../types';
import { store } from './store';

export interface MaintenanceInput {
  equipmentId: string;
  maintenanceType: string;
  problem: string;
  action: string;
  partsReplaced: string;
  technician: string;
  date: string;
  startTime: string;
  endTime: string;
  downtimeHours: number;
  notes: string;
  status: string;
  result: string;
}

function uid(): string {
  return 'm-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

export function recordMaintenance(input: MaintenanceInput): MaintenanceRecord {
  const rec: MaintenanceRecord = {
    id: uid(),
    equipmentId: input.equipmentId,
    date: input.date,
    maintenanceType: input.maintenanceType,
    problem: input.problem,
    action: input.action,
    partsReplaced: input.partsReplaced,
    technician: input.technician,
    startTime: input.startTime,
    endTime: input.endTime,
    downtimeHours: input.downtimeHours,
    notes: input.notes,
    status: input.status,
    result: input.result,
    createdAt: new Date().toISOString()
  };

  // Save the record and update the equipment: reset the condition to normal and
  // stamp the last maintenance date so the dashboard reflects the completed work.
  store.update((s) => ({
    ...s,
    maintenance: [rec, ...s.maintenance],
    equipment: s.equipment.map((e) =>
      e.equipmentId === input.equipmentId
        ? { ...e, status: 'NORMAL', lastMaintenanceDate: rec.date }
        : e
    )
  }));
  return rec;
}

export function listMaintenance(filters?: {
  equipmentId?: string;
  type?: string;
  status?: string;
  priority?: string;
  from?: string;
  to?: string;
}): MaintenanceRecord[] {
  let recs = [...store.get().maintenance];
  if (filters) {
    const { equipmentId, type, status, from, to } = filters;
    if (equipmentId) recs = recs.filter((r) => r.equipmentId === equipmentId);
    if (type) recs = recs.filter((r) => r.maintenanceType === type);
    if (status) recs = recs.filter((r) => r.status === status);
    if (from) recs = recs.filter((r) => r.date >= from);
    if (to) recs = recs.filter((r) => r.date <= to);
  }
  recs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
  return recs;
}

export function forEquipment(equipmentId: string): MaintenanceRecord[] {
  return listMaintenance({ equipmentId });
}

export function partsHistory(equipmentId: string): MaintenanceRecord[] {
  return forEquipment(equipmentId).filter((r) => r.partsReplaced && r.partsReplaced !== 'None' && r.partsReplaced.trim() !== '');
}

export function failureHistory(equipmentId: string): MaintenanceRecord[] {
  return forEquipment(equipmentId).filter((r) => r.status === 'Completed' && (r.problem.toLowerCase().includes('repair') || r.maintenanceType.toLowerCase().includes('repair')));
}

export function totalDowntime(equipmentId: string): { hours: number; count: number } {
  const recs = forEquipment(equipmentId);
  return { hours: Math.round(recs.reduce((a, r) => a + (r.downtimeHours || 0), 0) * 10) / 10, count: recs.length };
}