/* Temporary end-to-end verification against an isolated test database.
   Run with MONGODB_URI pointing at a throwaway DB; it drops that DB at the end. */
const mongoose = require('mongoose');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:4000';
const results = [];
let token = '';

function check(name, condition, extra) {
  results.push({ name, ok: !!condition, extra });
  console.log(`${condition ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function call(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  return { status: response.status, payload };
}

async function main() {
  const health = await call('/api/health');
  check('health endpoint reachable', health.status === 200 && health.payload.database === 'connected', `db=${health.payload && health.payload.database}`);

  const register = await call('/api/auth/register', {
    method: 'POST',
    body: { name: 'E2E Tester', email: 'e2e@test.local', username: 'e2etester', password: 'e2etest123', title: 'Tester' }
  });
  check('register works on empty database', register.status === 201 && !!register.payload.token);
  token = register.payload.token;

  const emptyMachines = await call('/api/machines');
  check('empty database has no machines', emptyMachines.payload.count === 0, `count=${emptyMachines.payload.count}`);

  const emptyReport = await call('/api/reports/summary');
  check('empty report has no fabricated data', emptyReport.payload.hasData === false && emptyReport.payload.totals.machines === 0);

  const machine = await call('/api/machines', {
    method: 'POST',
    body: { machineId: 'E2E-001', name: 'E2E Mixer', machineType: 'Mixer', location: 'Test Line', criticality: 'high', operatingHours: 1200 }
  });
  check('machine saved to MongoDB', machine.status === 201 && !!machine.payload.machine._id);
  const machineId = machine.payload.machine._id;

  const insufficient = await call('/api/analysis/maintenance-case', {
    method: 'POST',
    body: { machine: machineId, currentProblem: 'Bearing noise and overheating', symptoms: ['noise', 'heat'] }
  });
  check(
    'analysis refuses to invent results without history',
    insufficient.status === 201 && insufficient.payload.maintenanceCase.analysis.sufficientData === false,
    insufficient.payload.maintenanceCase.analysis.message
  );
  const caseId = insufficient.payload.maintenanceCase._id;

  const history = [
    { problem: 'Bearing noise at drive end', action: 'Replaced bearing and realigned coupling', partsReplaced: ['bearing', 'coupling'], downtimeHours: 4 },
    { problem: 'Bearing noise and heat detected', action: 'Replaced bearing and realigned coupling', partsReplaced: ['bearing'], downtimeHours: 5 },
    { problem: 'Bearing noise with overheating', action: 'Replaced bearing and realigned coupling', partsReplaced: ['bearing', 'seal'], downtimeHours: 6 }
  ];
  for (let i = 0; i < history.length; i += 1) {
    const record = history[i];
    const created = await call('/api/maintenance', {
      method: 'POST',
      body: {
        machine: machineId,
        date: new Date(Date.now() - (i + 1) * 86400000 * 30).toISOString(),
        maintenanceType: 'corrective',
        problem: record.problem,
        action: record.action,
        partsReplaced: record.partsReplaced,
        technician: 'E2E Tester',
        downtimeHours: record.downtimeHours
      }
    });
    check(`maintenance record ${i + 1} saved`, created.status === 201);
  }

  const failure = await call('/api/failures', {
    method: 'POST',
    body: {
      machine: machineId,
      date: new Date(Date.now() - 86400000 * 45).toISOString(),
      failureMode: 'Bearing seizure',
      cause: 'Insufficient lubrication',
      symptoms: ['noise', 'heat', 'vibration'],
      severity: 'major',
      downtimeHours: 9,
      correctiveAction: 'Replaced bearing and realigned coupling'
    }
  });
  check('failure record saved', failure.status === 201);

  const analysed = await call(`/api/maintenance-cases/${caseId}/analyze`, { method: 'POST' });
  const analysis = analysed.payload.maintenanceCase.analysis;
  check(
    'analysis now uses real historical records',
    analysed.status === 200 && analysis.sufficientData === true && analysis.suggestions.length > 0,
    `suggestions=${analysis.suggestions.length} comparable=${analysis.statistics.comparableCases}`
  );
  check(
    'suggestion carries real evidence ids',
    analysis.suggestions.length > 0 && analysis.suggestions[0].sourceRecordIds.length >= 3,
    `evidence=${analysis.suggestions[0] ? analysis.suggestions[0].sourceRecordIds.length : 0} confidence=${analysis.suggestions[0] ? analysis.suggestions[0].confidence : 0}%`
  );
  check(
    'suggestion carries human-friendly evidence strings',
    analysis.suggestions.length > 0 && Array.isArray(analysis.suggestions[0].evidence) && analysis.suggestions[0].evidence.length >= 1,
    `sample="${analysis.suggestions[0] && analysis.suggestions[0].evidence ? analysis.suggestions[0].evidence[0] : 'none'}"`
  );

  const review = await call(`/api/maintenance-cases/${caseId}/review`, {
    method: 'PUT',
    body: { decision: 'accepted', reviewerNote: 'Matches historical practice.' }
  });
  check('review decision saved', review.status === 200 && review.payload.maintenanceCase.review.decision === 'accepted');

  const outcome = await call(`/api/maintenance-cases/${caseId}/outcome`, {
    method: 'PUT',
    body: {
      result: 'resolved',
      actionTaken: 'Replaced bearing and realigned coupling',
      partsReplaced: ['bearing', 'coupling'],
      downtimeHours: 4,
      technician: 'E2E Tester'
    }
  });
  check('outcome saved and case completed', outcome.status === 200 && outcome.payload.maintenanceCase.status === 'completed');

  const historyAfter = await call(`/api/machines/${machineId}/maintenance`);
  check('completed case wrote a real maintenance record', historyAfter.payload.count === 4, `records=${historyAfter.payload.count}`);

  const testing = await call('/api/testing/cases', {
    method: 'POST',
    body: {
      machine: machineId,
      maintenanceCase: caseId,
      description: 'E2E comparison',
      expectedSuggestion: 'Replaced bearing and realigned coupling',
      actualSuggestion: 'Replaced bearing and realigned coupling'
    }
  });
  check('testing case saved with computed match', testing.status === 201 && testing.payload.record.matchScore === 100);

  const summary = await call('/api/reports/summary');
  check(
    'report aggregates real records',
    summary.payload.totals.machines === 1 && summary.payload.totals.maintenanceRecords === 4 && summary.payload.totals.completedCases === 1,
    JSON.stringify(summary.payload.totals)
  );

  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('temporary test database dropped');

  const failures = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
  process.exit(failures.length === 0 ? 0 : 1);

}

main().catch(async (error) => {
  console.error('E2E ERROR', error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
