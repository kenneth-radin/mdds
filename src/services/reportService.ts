import { SensorReading, Equipment, MaintenanceRecord, Recommendation } from '../types';
import { store } from './store';
import { listEquipment, getEquipment } from './equipmentService';
import { getLatestReading, getReadings } from './sensorService';
import { listMaintenance, partsHistory, totalDowntime } from './maintenanceService';
import { listRecommendations } from './recommendationService';
import { fmtDateTime } from '../utils/params';

export interface ReportDataset {
  headers: string[];
  rows: (string | number)[][];
}

export function equipmentConditionReport(): ReportDataset {
  const headers = ['Equipment', 'Temperature (°C)', 'Vibration (mm/s)', 'Voltage (V)', 'Current (A)', 'Condition', 'Source'];
  const rows = listEquipment().map((eq) => {
    const r = getLatestReading(eq.equipmentId);
    return [
      `${eq.equipmentId} · ${eq.name}`,
      r ? Math.round(r.temperature * 10) / 10 : '-',
      r ? Math.round(r.vibration * 10) / 10 : '-',
      r ? Math.round(r.voltage * 10) / 10 : '-',
      r ? Math.round(r.current * 10) / 10 : '-',
      eq.status,
      r ? r.source : '-'
    ];
  });
  return { headers, rows };
}

export function sensorTrendReport(equipmentId: string): ReportDataset {
  const eq = getEquipment(equipmentId);
  const headers = ['Equipment', 'Timestamp', 'Temperature (°C)', 'Vibration (mm/s)', 'Voltage (V)', 'Current (A)', 'Source'];
  const rows = eq ? getReadings(equipmentId).map((r) => [
    eq.equipmentId,
    fmtDateTime(r.timestamp),
    Math.round(r.temperature * 10) / 10,
    Math.round(r.vibration * 10) / 10,
    Math.round(r.voltage * 10) / 10,
    Math.round(r.current * 10) / 10,
    r.source
  ]) : [];
  return { headers, rows };
}

export function maintenanceReport(filters?: any): ReportDataset {
  const headers = ['Equipment', 'Date', 'Type', 'Problem', 'Action', 'Parts', 'Technician', 'Downtime (h)', 'Status'];
  const rows = listMaintenance(filters).map((r) => {
    const eq = getEquipment(r.equipmentId);
    return [
      eq ? `${eq.equipmentId} · ${eq.name}` : r.equipmentId,
      r.date,
      r.maintenanceType,
      r.problem,
      r.action,
      r.partsReplaced,
      r.technician,
      r.downtimeHours,
      r.status
    ];
  });
  return { headers, rows };
}

export function recommendationReport(): ReportDataset {
  const headers = ['Equipment', 'Date', 'Condition', 'Need', 'Priority', 'Recommendation', 'Schedule', 'Decision'];
  const rows = listRecommendations().map((r) => [
    `${r.equipmentId} · ${r.equipmentName}`,
    fmtDateTime(r.date),
    r.condition,
    r.maintenanceNeed,
    r.priority,
    r.recommendedAction,
    r.suggestedSchedule,
    r.decision || 'pending'
  ]);
  return { headers, rows };
}

export function failureReport(): ReportDataset {
  const headers = ['Equipment', 'Date', 'Problem', 'Action', 'Parts', 'Technician'];
  const rows: (string | number)[][] = [];
  for (const eq of listEquipment()) {
    for (const m of store.get().maintenance.filter((x) => x.equipmentId === eq.equipmentId && x.maintenanceType.toLowerCase().includes('repair'))) {
      rows.push([`${eq.equipmentId} · ${eq.name}`, m.date, m.problem, m.action, m.partsReplaced, m.technician]);
    }
  }
  return { headers, rows };
}

export function downtimeReport(): ReportDataset {
  const headers = ['Equipment', 'Records', 'Total Downtime (h)'];
  const rows = listEquipment().map((eq) => {
    const d = totalDowntime(eq.equipmentId);
    return [`${eq.equipmentId} · ${eq.name}`, d.count, d.hours];
  });
  return { headers, rows };
}