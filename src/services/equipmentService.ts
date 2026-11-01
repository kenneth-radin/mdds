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

// Keep the existing threshold bands for the single compressor. Voltage and
// current are retained in the threshold config for backwards compatibility with
// any code that still reads them; the live dashboard and anomaly layer now
// focus exclusively on temperature and vibration.
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

// NOTE: addEquipment and removeEquipment were removed in favour of a single,
// fixed compressor. Do not export addEquipment/removeEquipment anymore -- the
// app now manages one machine defined in src/data/seed.ts.