import { Equipment, SensorReading } from '../types';
import { getLatestReading } from './sensorService';
import { store } from './store';
import { mulberry32 } from '../data/seed';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Produces the numeric sample for the next simulated time step. The UI calls
// sensorService.addReading to persist it; this keeps the generated data clearly
// separate from real (live / IoT) sensor input.
export function generateSimulatedReading(eq: Equipment): {
  equipmentId: string;
  temperature: number;
  vibration: number;
  voltage: number;
  current: number;
  operatingHours: number;
  observation: string;
  source: 'simulated';
} {
  const cfg = store.get().simulation;
  const rnd = mulberry32(Math.floor(Date.now() / 1000) + (eq.equipmentId.charCodeAt(4) || 0));
  const latest = getLatestReading(eq.equipmentId);
  const creep = eq.status === 'WARNING' || eq.status === 'CRITICAL' ? 0.15 : -0.02;

  let temperature: number;
  let vibration: number;
  let voltage: number;
  let current: number;

  if (latest) {
    temperature = clamp(latest.temperature + (rnd() - 0.5) * 2 * 0.6 + creep, 10, 110);
    vibration = clamp(latest.vibration + (rnd() - 0.5) * 2 * 0.12 + creep * 0.4, 0.2, 12);
    voltage = clamp(latest.voltage + (rnd() - 0.5) * 2 * 1.2, 190, 250);
    current = clamp(latest.current + (rnd() - 0.5) * 2 * 0.25 + creep, 0.2, eq.ratedCurrent * 1.5);
  } else {
    temperature = 56 + (rnd() - 0.5) * 4;
    vibration = 1.8 + (rnd() - 0.5) * 0.6;
    voltage = 220 + (rnd() - 0.5) * 4;
    current = Math.round(eq.ratedCurrent * (0.7 + rnd() * 0.15) * 10) / 10;
  }

  return {
    equipmentId: eq.equipmentId,
    temperature: Math.round(temperature * 10) / 10,
    vibration: Math.round(vibration * 10) / 10,
    voltage: Math.round(voltage * 10) / 10,
    current: Math.round(current * 10) / 10,
    operatingHours: latest ? latest.operatingHours + 5 : eq.operatingHours,
    observation: 'Simulated live feed.',
    source: 'simulated'
  };
}

export function simulateNext(eq: Equipment): SensorReading {
  const sample = generateSimulatedReading(eq);
  return {
    ...sample,
    id: 'sim-' + Date.now().toString(36),
    timestamp: new Date().toISOString()
  } as SensorReading;
}