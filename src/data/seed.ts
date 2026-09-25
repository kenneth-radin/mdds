import { Equipment, ThresholdConfig, SensorReading, MaintenanceRecord, ParameterKey } from '../types';

// Deterministic PRNG so the seeded demo data is reproducible every reset.
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mkFile(name: string): ThresholdConfig {
  // Motor current bands are relative to the rated current (multipliers).
  return {
    temperature: {
      unit: '°C', relative: false,
      bands: {
        normal: [{ min: null, max: 70 }],
        warning: [{ min: 70, max: 85 }],
        critical: [{ min: 85, max: null }]
      },
      note: name
    },
    vibration: {
      unit: 'mm/s', relative: false,
      bands: {
        normal: [{ min: null, max: 2.8 }],
        warning: [{ min: 2.8, max: 4.5 }],
        critical: [{ min: 4.5, max: null }]
      },
      note: name
    },
    voltage: {
      unit: 'V', relative: false,
      bands: {
        normal: [{ min: 210, max: 230 }],
        warning: [{ min: 200, max: 210 }, { min: 230, max: 240 }],
        critical: [{ min: null, max: 200 }, { min: 240, max: null }]
      },
      note: name
    },
    current: {
      unit: 'A', relative: true,
      bands: {
        normal: [{ min: null, max: 1.0 }],
        warning: [{ min: 1.0, max: 1.1667 }],
        critical: [{ min: 1.1667, max: null }]
      },
      note: name
    }
  };
}

export interface EquipProfile {
  equipmentId: string;
  id: string;
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  ratedVoltage: number;
  ratedCurrent: number;
  ratedPowerKw: number;
  installDate: string;
  location: string;
  operatingHoursBase: number;
  start: { temperature: number; vibration: number; voltage: number; current: number };
  target: { temperature: number; vibration: number; voltage: number; current: number };
  noise: { temperature: number; vibration: number; voltage: number; current: number };
  lastMaintenanceDate: string;
}

export const PROFILES: EquipProfile[] = [
  {
    id: 'e1', equipmentId: 'MTR-001', name: 'Motor Pump 01', type: 'Centrifugal Pump Motor',
    manufacturer: 'ACME Industrial', model: 'CP-4000', ratedVoltage: 230, ratedCurrent: 12, ratedPowerKw: 3.0,
    installDate: '2021-03-15', location: 'Process Hall - Line A', operatingHoursBase: 12480,
    start: { temperature: 54, vibration: 1.7, voltage: 221, current: 9.6 },
    target: { temperature: 71.5, vibration: 3.6, voltage: 218, current: 12.4 },
    noise: { temperature: 1.4, vibration: 0.22, voltage: 1.6, current: 0.5 },
    lastMaintenanceDate: '2025-08-02'
  },
  {
    id: 'e2', equipmentId: 'MTR-002', name: 'Motor Pump 02', type: 'Centrifugal Pump Motor',
    manufacturer: 'ACME Industrial', model: 'CP-3200', ratedVoltage: 230, ratedCurrent: 10, ratedPowerKw: 2.4,
    installDate: '2022-01-20', location: 'Process Hall - Line B', operatingHoursBase: 9050,
    start: { temperature: 52, vibration: 1.5, voltage: 220, current: 8.6 },
    target: { temperature: 57, vibration: 1.9, voltage: 220, current: 9.3 },
    noise: { temperature: 1.1, vibration: 0.18, voltage: 1.4, current: 0.4 },
    lastMaintenanceDate: '2026-05-11'
  },
  {
    id: 'e3', equipmentId: 'MTR-003', name: 'Conveyor Motor 01', type: 'Gearbox Drive Motor',
    manufacturer: 'Vector Drives', model: 'GB-7500', ratedVoltage: 230, ratedCurrent: 11, ratedPowerKw: 2.8,
    installDate: '2020-09-05', location: 'Sorting Bay - Belt 3', operatingHoursBase: 17240,
    start: { temperature: 55, vibration: 1.9, voltage: 222, current: 9.8 },
    target: { temperature: 66, vibration: 3.1, voltage: 221, current: 11.6 },
    noise: { temperature: 1.2, vibration: 0.2, voltage: 1.5, current: 0.45 },
    lastMaintenanceDate: '2026-02-18'
  },
  {
    id: 'e4', equipmentId: 'MTR-004', name: 'Industrial Fan 01', type: 'Axial Fan Motor',
    manufacturer: 'Airflow Systems', model: 'AX-900', ratedVoltage: 230, ratedCurrent: 15, ratedPowerKw: 3.4,
    installDate: '2021-11-08', location: 'Ventilation - Roof C', operatingHoursBase: 11200,
    start: { temperature: 44, vibration: 1.8, voltage: 219, current: 6.9 },
    target: { temperature: 46, vibration: 2.1, voltage: 219, current: 7.4 },
    noise: { temperature: 1.0, vibration: 0.16, voltage: 1.4, current: 0.35 },
    lastMaintenanceDate: '2026-07-22'
  },
  {
    id: 'e5', equipmentId: 'MTR-005', name: 'Compressor Motor 01', type: 'Screw Compressor Motor',
    manufacturer: 'VTX Compressors', model: 'SC-5200', ratedVoltage: 230, ratedCurrent: 12, ratedPowerKw: 4.1,
    installDate: '2019-06-30', location: 'Utility Plant - Bay 2', operatingHoursBase: 22460,
    start: { temperature: 60, vibration: 2.3, voltage: 220, current: 10.4 },
    target: { temperature: 88.5, vibration: 5.2, voltage: 217, current: 13.1 },
    noise: { temperature: 1.6, vibration: 0.26, voltage: 1.8, current: 0.6 },
    lastMaintenanceDate: '2025-11-09'
  }
];

export function makeEquipment(p: EquipProfile): Equipment {
  return {
    id: p.id,
    equipmentId: p.equipmentId,
    name: p.name,
    type: p.type,
    equipmentType: p.type.split(' ')[0] + ' Motor',
    manufacturer: p.manufacturer,
    model: p.model,
    ratedVoltage: p.ratedVoltage,
    ratedCurrent: p.ratedCurrent,
    ratedPowerKw: p.ratedPowerKw,
    operatingHours: p.operatingHoursBase,
    installDate: p.installDate,
    location: p.location,
    status: 'NORMAL',
    lastMaintenanceDate: p.lastMaintenanceDate,
    specs: {
      bearings: 'Sealed ball bearings',
      cooling: 'Air-cooled, forced ventilation',
      driveType: 'Direct coupled',
      enclosure: 'IP55 protection',
      notes: 'Recommended lubrication every 2000 operating hours.'
    },
    thresholds: mkFile(p.name),
    monitoringEnabled: true
  };
}function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

function noiseTerm(amp: number, r: number): number {
  return (r - 0.5) * 2 * amp;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h & 0x7fffffff;
}

// ~7 days of history, sampled every 4 hours, trending from `start` toward the
// current `target` reading so the demo data is internally consistent.
export function genHistory(eq: Equipment, p: EquipProfile): SensorReading[] {
  const rnd = mulberry32(hash(p.equipmentId + '-hist'));
  const n = 42;
  const stepMin = 240;
  const now = new Date();
  const startMs = now.getTime() - (n - 1) * stepMin * 60000;
  const out: SensorReading[] = [];
  for (let i = 0; i < n; i++) {
    const f = n <= 1 ? 1 : i / (n - 1);
    const isLast = i === n - 1;
    const wave = 0.35 * Math.sin(i / 2.4);
    const tT = lerp(p.start.temperature, p.target.temperature, f) + noiseTerm(p.noise.temperature, rnd()) + wave;
    const tV = lerp(p.start.vibration, p.target.vibration, f) + noiseTerm(p.noise.vibration, rnd());
    const tU = lerp(p.start.voltage, p.target.voltage, f) + noiseTerm(p.noise.voltage, rnd()) + 0.4 * Math.sin(i / 1.7);
    const tI = lerp(p.start.current, p.target.current, f) + noiseTerm(p.noise.current, rnd());
    const reading: SensorReading = {
      id: `${p.id}-h${i}`,
      equipmentId: p.equipmentId,
      timestamp: new Date(startMs + i * stepMin * 60000).toISOString(),
      temperature: isLast ? p.target.temperature : Math.max(10, tT),
      vibration: isLast ? p.target.vibration : Math.max(0.2, tV),
      voltage: isLast ? p.target.voltage : Math.max(100, tU),
      current: isLast ? p.target.current : Math.max(0.2, tI),
      operatingHours: Math.round(p.operatingHoursBase + (i * stepMin) / 60),
      observation: isLast ? 'Latest simulated sample.' : '',
      source: 'simulated'
    };
    out.push(reading);
  }
  return out;
}

export function genMaintenance(p: EquipProfile, eq: Equipment): MaintenanceRecord[] {
  const rnd = mulberry32(hash(p.equipmentId + '-maint'));
  const ty = ['Scheduled Inspection', 'Preventive Maintenance', 'Corrective Repair', 'Lubrication Service'];
  const parts = ['None', 'Bearing set', 'Cooling fan', 'V-belt', 'Contactors', 'Oil seal'];
  const action = [
    'Cleaned cooling fan, checked windings and measured insulation resistance.',
    'Replaced worn bearings and balanced the rotor.',
    'Re-torqued terminal connections and verified protective settings.',
    'Relubricated bearings and inspected coupling for wear.'
  ];
  const techs = ['John Doe', 'A. Rivera', 'S. Choi', 'M. Reyes'];
  const results = ['Completed - equipment returned to normal operation.', 'Completed - condition improved.', 'Completed - follow-up monitoring scheduled.'];
  const recs: MaintenanceRecord[] = [];
  const count = 3;
  const now = new Date().getTime();
  for (let k = 0; k < count; k++) {
    const daysBack = (k + 1) * 90 + Math.floor(rnd() * 40);
    const dt = new Date(now - daysBack * 86400000);
    const start = new Date(dt.getTime());
    const end = new Date(start.getTime() + (60 + Math.floor(rnd() * 180)) * 60000);
    recs.push({
      id: `${p.id}-m${k}`,
      equipmentId: p.equipmentId,
      date: start.toISOString().slice(0, 10),
      maintenanceType: ty[Math.floor(rnd() * ty.length)],
      problem: 'Observed elevated vibration and temperature in routine monitoring.',
      action: action[Math.floor(rnd() * action.length)],
      partsReplaced: parts[Math.floor(rnd() * parts.length)],
      technician: techs[Math.floor(rnd() * techs.length)],
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      downtimeHours: Math.round(((end.getTime() - start.getTime()) / 3600000) * 10) / 10,
      notes: 'Routine maintenance cycle.',
      status: 'Completed',
      result: results[Math.floor(rnd() * results.length)],
      createdAt: start.toISOString()
    });
  }
  recs.sort((a, b) => (a.date < b.date ? 1 : -1));
  return recs;
}

export function buildSeed(): { equipment: Equipment[]; readings: SensorReading[]; maintenance: MaintenanceRecord[] } {
  const equipment = PROFILES.map(makeEquipment);
  const readings: SensorReading[] = [];
  const maintenance: MaintenanceRecord[] = [];
  for (const p of PROFILES) {
    const eq = equipment.find((x) => x.id === p.id)!;
    readings.push(...genHistory(eq, p));
    maintenance.push(...genMaintenance(p, eq));
  }
  return { equipment, readings, maintenance };
}
