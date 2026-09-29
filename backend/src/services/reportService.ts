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

  const [machinesByCriticality, maintenanceByType, failuresBySeverity, casesByStatus, downtimeAgg, testingAgg, decisionAgg] =
    await Promise.all([
      groupCount(Machine as never, 'criticality'),
      groupCount(MaintenanceRecord as never, 'maintenanceType'),
      groupCount(FailureRecord as never, 'severity'),
      groupCount(MaintenanceCase as never, 'status'),
      MaintenanceRecord.aggregate([{ $group: { _id: null, total: { $sum: '$downtimeHours' } } }]),
      TestingCase.aggregate([
        { $group: { _id: null, total: { $sum: 1 }, matched: { $sum: { $cond: ['$matched', 1, 0] } } } }
      ]),
      // §46: how maintenance personnel actually responded to the AI suggestions.
      MaintenanceCase.aggregate([{ $group: { _id: '$review.decision', count: { $sum: 1 } } }])
    ]);

  const overallDowntimeHours = Number(downtimeAgg[0]?.total || 0);
  const testingTotal = Number(testingAgg[0]?.total || 0);
  const testingMatched = Number(testingAgg[0]?.matched || 0);

  // Bucket every case by its review decision. Cases never reviewed (review.decision
  // absent/null) count as notReviewed, so the four buckets always sum to the
  // total number of cases - the values are derived, never assumed.
  const suggestionDecisions = { accepted: 0, modified: 0, rejected: 0, notReviewed: 0 };
  for (const row of decisionAgg as Array<{ _id: string | null; count: number }>) {
    if (row._id === 'accepted' || row._id === 'modified' || row._id === 'rejected') {
      suggestionDecisions[row._id] = row.count;
    } else {
      suggestionDecisions.notReviewed += row.count;
    }
  }

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
    },
    suggestionDecisions
  };
}
