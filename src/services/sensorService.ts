import { SensorReading, Equipment, DataSource } from '../types';
import { store } from './store';
import { processReading } from './processingService';

export function getReadings(equipmentId: string, sinceHours?: number): SensorReading[] {
  const all = store.get().readings.filter((r) => r.equipmentId === equipmentId);
  all.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
  if (sinceHours) {
    const cutoff = Date.now() - sinceHours * 3600000;
    return all.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
  }
  return all;
}

export function getLatestReading(equipmentId: string): SensorReading | undefined {
  const all = getReadings(equipmentId);
  return all.length ? all[all.length - 1] : undefined;
}

export interface IngestResult {
  reading: SensorReading;
  status: string;
}

export function addReading(input: {
  equipmentId: string;
  temperature: number;
  vibration: number;
  voltage: number;
  current: number;
  observation?: string;
  source?: DataSource;
  operatingHours?: number;
  timestamp?: string;
}): IngestResult {
  const eq = store.get().equipment.find((e) => e.equipmentId === input.equipmentId);
  if (!eq) throw new Error('Unknown equipment');
  const reading: SensorReading = {
    id: 'rd-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    equipmentId: input.equipmentId,
    timestamp: input.timestamp || new Date().toISOString(),
    temperature: input.temperature,
    vibration: input.vibration,
    voltage: input.voltage,
    current: input.current,
    operatingHours: input.operatingHours ?? eq.operatingHours,
    observation: input.observation || '',
    source: input.source || 'simulated'
  };
  const history = getReadings(input.equipmentId);
  const pr = processReading(eq, reading, history);

  store.update((s) => {
    const readings = [...s.readings, reading];
    const equipment = s.equipment.map((e) =>
      e.equipmentId === input.equipmentId
        ? { ...e, status: pr.overall, operatingHours: reading.operatingHours, lastMaintenanceDate: e.lastMaintenanceDate }
        : e
    );
    return { ...s, readings, equipment };
  });

  return { reading, status: pr.overall };
}

export function clearReadings(equipmentId: string): void {
  store.update((s) => ({ ...s, readings: s.readings.filter((r) => r.equipmentId !== equipmentId) }));
}