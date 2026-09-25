import { Machine } from '../models/Machine';
import { MaintenanceRecord } from '../models/MaintenanceRecord';
import { FailureRecord } from '../models/FailureRecord';
import { OperationalData } from '../models/OperationalData';
import { MaintenanceCase } from '../models/MaintenanceCase';
import { TestingCase } from '../models/TestingCase';
import { round } from '../utils/helpers';

async function groupCount(model: { aggregate: (pipeline: unknown[]) => Promise<Array<{ _id: string | null; count: number }>> }, field: string) {
  return model.aggregate([
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
}

export async function buildSummaryReport() {
  const [
    totalMachines,
    totalMaintenanceRecords,
    totalFailureRecords,
    totalOperationalRecords,
    totalCases,
    totalCompletedCases,
    totalTestingCases
  ] = await Promise.all([
    Machine.countDocuments({}),
    MaintenanceRecord.countDocuments({}),
    FailureRecord.countDocuments({}),
    OperationalData.countDocuments({}),
    MaintenanceCase.countDocuments({}),
    MaintenanceCase.countDocuments({ status: 'completed' }),
    TestingCase.countDocuments({})
  ]);

  const [machinesByCriticality, maintenanceByType, failuresBySeverity, casesByStatus, downtimeAgg, testingAgg] =
    await Promise.all([
      groupCount(Machine as never, 'criticality'),
      groupCount(MaintenanceRecord as never, 'maintenanceType'),
      groupCount(FailureRecord as never, 'severity'),
      groupCount(MaintenanceCase as never, 'status'),
      MaintenanceRecord.aggregate([{ $group: { _id: null, total: { $sum: '$downtimeHours' } } }]),
      TestingCase.aggregate([
        { $group: { _id: null, total: { $sum: 1 }, matched: { $sum: { $cond: ['$matched', 1, 0] } } } }
      ])
    ]);

  const overallDowntimeHours = Number(downtimeAgg[0]?.total || 0);
  const testingTotal = Number(testingAgg[0]?.total || 0);
  const testingMatched = Number(testingAgg[0]?.matched || 0);

  return {
    generatedAt: new Date().toISOString(),
    hasData: totalMachines + totalMaintenanceRecords + totalFailureRecords + totalOperationalRecords + totalCases > 0,
    message:
      totalMachines + totalMaintenanceRecords + totalFailureRecords + totalOperationalRecords + totalCases === 0
        ? 'No data available yet. Register machines and enter historical records to generate reports.'
        : '',
    totals: {
      machines: totalMachines,
      maintenanceRecords: totalMaintenanceRecords,
      failureRecords: totalFailureRecords,
      operationalRecords: totalOperationalRecords,
      maintenanceCases: totalCases,
      completedCases: totalCompletedCases,
      testingCases: totalTestingCases,
      overallDowntimeHours: round(overallDowntimeHours, 2)
    },
    machinesByCriticality: machinesByCriticality.map((x) => ({ criticality: x._id || 'unknown', count: x.count })),
    maintenanceByType: maintenanceByType.map((x) => ({ maintenanceType: x._id || 'unknown', count: x.count })),
    failuresBySeverity: failuresBySeverity.map((x) => ({ severity: x._id || 'unknown', count: x.count })),
    casesByStatus: casesByStatus.map((x) => ({ status: x._id || 'unknown', count: x.count })),
    testing: {
      total: testingTotal,
      matched: testingMatched,
      matchRate: testingTotal > 0 ? round((testingMatched / testingTotal) * 100, 1) : null
    }
  };
}
