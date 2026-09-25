import { Equipment, Condition } from '../types';
import { store } from './store';

export function listEquipment(): Equipment[] {
  const s = store.get();
  return [...s.equipment].sort((a, b) => (a.equipmentId < b.equipmentId ? -1 : 1));
}

export function getEquipment(equipmentId: string): Equipment | undefined {
  return store.get().equipment.find((e) => e.equipmentId === equipmentId);
}

export function getEquipmentById(id: string): Equipment | undefined {
  return store.get().equipment.find((e) => e.id === id);
}

export function updateEquipment(equipmentId: string, patch: Partial<Equipment>): Equipment | undefined {
  let updated: Equipment | undefined;
  store.update((s) => ({
    ...s,
    equipment: s.equipment.map((e) => {
      if (e.equipmentId === equipmentId) {
        updated = { ...e, ...patch };
        return updated;
      }
      return e;
    })
  }));
  return updated;
}

export function setStatus(equipmentId: string, status: Condition): void {
  updateEquipment(equipmentId, { status });
}

export function toggleMonitoring(equipmentId: string): void {
  const e = getEquipment(equipmentId);
  if (e) updateEquipment(equipmentId, { monitoringEnabled: !e.monitoringEnabled });
}

export function summary(): Record<string, number> {
  const eqs = listEquipment();
  return {
    total: eqs.length,
    normal: eqs.filter((e) => e.status === 'NORMAL').length,
    warning: eqs.filter((e) => e.status === 'WARNING').length,
    critical: eqs.filter((e) => e.status === 'CRITICAL').length,
    offline: eqs.filter((e) => e.status === 'OFFLINE' || !e.monitoringEnabled).length
  };
}

export function maintenanceDueCount(): number {
  const st = store.get();
  let count = 0;
  for (const e of st.equipment) {
    if (e.status === 'WARNING' || e.status === 'CRITICAL') count++;
  }
  return count;
}

function uid(): string {
  return 'eq-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

export function defaultThresholds(): Equipment['thresholds'] {
  return {
    temperature: {
      unit: '°C', relative: false,
      bands: { normal: [{ min: null, max: 70 }], warning: [{ min: 70, max: 85 }], critical: [{ min: 85, max: null }] }
    },
    vibration: {
      unit: 'mm/s', relative: false,
      bands: { normal: [{ min: null, max: 2.8 }], warning: [{ min: 2.8, max: 4.5 }], critical: [{ min: 4.5, max: null }] }
    },
    voltage: {
      unit: 'V', relative: false,
      bands: { normal: [{ min: 210, max: 230 }], warning: [{ min: 200, max: 210 }, { min: 230, max: 240 }], critical: [{ min: null, max: 200 }, { min: 240, max: null }] }
    },
    current: {
      unit: 'A', relative: true,
      bands: { normal: [{ min: null, max: 1.0 }], warning: [{ min: 1.0, max: 1.1667 }], critical: [{ min: 1.1667, max: null }] }
    }
  };
}

export function addEquipment(input: {
  equipmentId: string; name: string; type: string; manufacturer: string; model: string;
  ratedVoltage: number; ratedCurrent: number; location: string;
}): Equipment {
  const eq: Equipment = {
    id: uid(),
    equipmentId: input.equipmentId,
    name: input.name,
    type: input.type,
    equipmentType: 'Motor',
    manufacturer: input.manufacturer,
    model: input.model,
    ratedVoltage: input.ratedVoltage,
    ratedCurrent: input.ratedCurrent,
    ratedPowerKw: Math.round((input.ratedVoltage * input.ratedCurrent * 0.001) * 10) / 10,
    operatingHours: 0,
    installDate: new Date().toISOString().slice(0, 10),
    location: input.location,
    status: 'NORMAL',
    lastMaintenanceDate: null,
    specs: { bearings: '', cooling: '', driveType: '', enclosure: '', notes: '' },
    thresholds: defaultThresholds(),
    monitoringEnabled: true
  };
  store.update((s) => ({ ...s, equipment: [...s.equipment, eq] }));
  return eq;
}

export function removeEquipment(equipmentId: string): void {
  store.update((s) => ({
    ...s,
    equipment: s.equipment.filter((e) => e.equipmentId !== equipmentId),
    readings: s.readings.filter((r) => r.equipmentId !== equipmentId),
    maintenance: s.maintenance.filter((m) => m.equipmentId !== equipmentId),
    recommendations: s.recommendations.filter((r) => r.equipmentId !== equipmentId)
  }));
}