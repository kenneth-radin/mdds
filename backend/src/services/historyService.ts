import { MaintenanceRecord } from '../models/MaintenanceRecord';
import { FailureRecord } from '../models/FailureRecord';
import { OperationalData } from '../models/OperationalData';
import { MaintenanceCase, IHistoryStatistics } from '../models/MaintenanceCase';
import { IMachine } from '../models/Machine';
import { round } from '../utils/helpers';

export interface MachineHistory {
  maintenanceRecords: Array<Record<string, unknown>>;
  failureRecords: Array<Record<string, unknown>>;
  operationalRecords: Array<Record<string, unknown>>;
  completedCases: Array<Record<string, unknown>>;
}

export async function loadMachineHistory(machine: IMachine): Promise<MachineHistory> {
  const [maintenanceRecords, failureRecords, operationalRecords, completedCases] = await Promise.all([
    MaintenanceRecord.find({ machine: machine._id }).sort({ date: -1 }).lean(),
    FailureRecord.find({ machine: machine._id }).sort({ date: -1 }).lean(),
    OperationalData.find({ machine: machine._id }).sort({ date: -1 }).lean(),
    MaintenanceCase.find({ machine: machine._id, status: 'completed' }).sort({ dateReported: -1 }).lean()
  ]);
  return { maintenanceRecords, failureRecords, operationalRecords, completedCases };
}

export function average(values: number[], digits = 2): number | null {
  const usable = values.filter((v) => Number.isFinite(v));
  if (usable.length === 0) return null;
  return round(usable.reduce((a, b) => a + b, 0) / usable.length, digits);
}

export function countNamed(values: string[], limit = 5): Array<{ name: string; count: number }> {
  const map = new Map<string, number>();
  values.filter(Boolean).forEach((v) => map.set(v, (map.get(v) || 0) + 1));
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function countParts(parts: string[][], limit = 5): Array<{ part: string; count: number }> {
  const map = new Map<string, number>();
  parts.flat().filter(Boolean).forEach((p) => map.set(p, (map.get(p) || 0) + 1));
  return [...map.entries()]
    .map(([part, count]) => ({ part, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function computeStatistics(history: MachineHistory): IHistoryStatistics {
  const maint = history.maintenanceRecords as Array<Record<string, any>>;
  const failures = history.failureRecords as Array<Record<string, any>>;
  const operational = history.operationalRecords as Array<Record<string, any>>;
  const cases = history.completedCases as Array<Record<string, any>>;

  const times = (values: unknown[]): number[] =>
    values
      .map((v) => new Date(String(v)).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b);

  const gapsBetween = (values: unknown[]): number[] => {
    const sorted = times(values);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) gaps.push((sorted[i] - sorted[i - 1]) / 86400000);
    return gaps;
  };

  const numbers = (values: unknown[]): number[] =>
    values.map((v) => Number(v)).filter((n) => Number.isFinite(n));

  const caseAction = (c: Record<string, any>): string => String(c.actualAction?.actionTaken || '');

  return {
    totalMaintenanceRecords: maint.length,
    totalFailureRecords: failures.length,
    totalOperationalRecords: operational.length,
    totalCompletedCases: cases.length,
    mtbfDays: average(gapsBetween(failures.map((f) => f.date))),
    mttrHours: average(numbers(failures.map((f) => f.downtimeHours))),
    averageMaintenanceIntervalDays: average(gapsBetween(maint.map((m) => m.date))),
    averageDowntimeHours: average([
      ...numbers(maint.map((m) => m.downtimeHours)),
      ...numbers(cases.map((c) => c.actualAction?.downtimeHours))
    ]),
    averageCost: average(numbers(maint.map((m) => m.cost))),
    averageProductionLossUnits: average(numbers(maint.map((m) => m.productionLossUnits))),
    failureModes: countNamed(failures.map((f) => String(f.failureMode))).map((x) => ({ mode: x.name, count: x.count })),
    commonParts: countParts([
      ...maint.map((m) => (m.partsReplaced as string[]) || []),
      ...cases.map((c) => (c.actualAction?.partsReplaced as string[]) || [])
    ]),
    commonActions: countNamed(
      [...maint.map((m) => String(m.action)), ...cases.map(caseAction).filter(Boolean)],
      8
    ).map((x) => ({ action: x.name, count: x.count })),
    comparableCases: 0
  };
}
