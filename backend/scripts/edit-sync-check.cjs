/* Regression check for the record edit/delete sync rules (§12, §13) and the
   admin role endpoints. Run with MONGODB_URI pointing at a throwaway database
   and the API answering on E2E_BASE (default http://127.0.0.1:4123); the script
   drops that database when it finishes. */
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:4123';

let token = '';
let failures = 0;

function check(name, condition, extra) {
  if (!condition) failures += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function call(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 200) };
  }
  return { status: response.status, payload };
}

const day = (value) => (typeof value === 'string' ? value.slice(0, 10) : String(value));

async function main() {
  const health = await call('/api/health');
  check('backend reachable', health.status === 200 && health.payload.database === 'connected', `db=${health.payload && health.payload.database}`);
  if (!(health.status === 200 && health.payload.database === 'connected')) return;

  const reg = await call('/api/auth/register', {
    method: 'POST',
    body: { name: 'Verify Admin', email: 'verify.admin@test.local', username: 'verifyadmin', password: 'verifypw123', title: 'Manager' }
  });
  check('first account becomes admin', reg.status === 201 && reg.payload.user.role === 'admin', `status=${reg.status}`);
  token = reg.payload.token;
  const adminId = reg.payload.user.id;

  const machineA = await call('/api/machines', { method: 'POST', body: { machineId: 'VERIFY-A', name: 'Verify Pump A', machineType: 'Centrifugal Pump' } });
  const machineB = await call('/api/machines', { method: 'POST', body: { machineId: 'VERIFY-B', name: 'Verify Pump B', machineType: 'Centrifugal Pump' } });
  check('two machines created', machineA.status === 201 && machineB.status === 201);
  const aId = machineA.payload.machine._id;
  const bId = machineB.payload.machine._id;
  const getMachine = async () => (await call(`/api/machines/${aId}`)).payload.machine;

  // ----- maintenance: edited or deleted dates keep machine.lastMaintenanceDate honest
  const postMaint = async (machine, date, problem = 'Routine job') =>
    (await call('/api/maintenance', {
      method: 'POST',
      body: { machine, date, maintenanceType: 'preventive', problem, action: 'Replaced seal', downtimeHours: 2, cost: 120 }
    })).payload.record;

  const m1 = await postMaint(aId, '2026-01-10');
  const m2 = await postMaint(aId, '2026-03-10');
  check('newest maintenance sets lastMaintenanceDate', day((await getMachine()).lastMaintenanceDate) === '2026-03-10');

  const put1 = await call(`/api/maintenance/${m2._id}`, { method: 'PUT', body: { date: '2026-02-05', problem: 'corrected' } });
  check('PUT maintenance saves the edit', put1.status === 200 && put1.payload.record.problem === 'corrected');
  const moved = await getMachine();
  check('edited date moves lastMaintenanceDate back', day(moved.lastMaintenanceDate) === '2026-02-05', day(moved.lastMaintenanceDate));

  await call(`/api/maintenance/${m2._id}`, { method: 'PUT', body: { machine: bId } });
  const afterRepoint = await call(`/api/maintenance/${m2._id}`);
  check('PUT cannot re-point a record at another machine', String(afterRepoint.payload.record.machine) === String(aId));
  const bRecords = await call(`/api/machines/${bId}/maintenance`);
  check('no record leaks into the other machine', bRecords.payload.count === 0, `count=${bRecords.payload.count}`);

  await call(`/api/maintenance/${m2._id}`, { method: 'PUT', body: { date: '2026-03-10' } });
  const restored = await getMachine();
  check('lastMaintenanceDate follows the newest record again', day(restored.lastMaintenanceDate) === '2026-03-10');

  const delNew = await call(`/api/maintenance/${m2._id}`, { method: 'DELETE' });
  const afterDelete = await getMachine();
  check('deleting the newest record resyncs lastMaintenanceDate', delNew.status === 200 && day(afterDelete.lastMaintenanceDate) === '2026-01-10', day(afterDelete.lastMaintenanceDate));

  await call(`/api/maintenance/${m1._id}`, { method: 'DELETE' });
  const emptied = await getMachine();
  check('deleting the last record clears lastMaintenanceDate', !emptied.lastMaintenanceDate, String(emptied.lastMaintenanceDate));

  // ----- operational: only the newest reading may move the machine meter
  const postOp = async (machine, date, operatingHours) =>
    (await call('/api/operational-data', { method: 'POST', body: { machine, date, operatingHours, downtimeHours: 1 } })).payload.record;

  const o1 = await postOp(aId, '2026-01-01', 100);
  const o2 = await postOp(aId, '2026-02-01', 200);
  const mirrored = await getMachine();
  check('newest operational reading mirrors onto the machine', mirrored.operatingHours === 200, `hours=${mirrored.operatingHours}`);

  const editOld = await call(`/api/operational-data/${o1._id}`, { method: 'PUT', body: { operatingHours: 50 } });
  check('older reading keeps its corrected hours', editOld.status === 200 && editOld.payload.record.operatingHours === 50);
  const afterOldEdit = await getMachine();
  check('older reading does not rewind the machine meter', afterOldEdit.operatingHours === 200, `hours=${afterOldEdit.operatingHours}`);

  const editNew = await call(`/api/operational-data/${o2._id}`, { method: 'PUT', body: { operatingHours: 250 } });
  const afterNewEdit = await getMachine();
  check('newest reading still updates the machine meter', editNew.status === 200 && afterNewEdit.operatingHours === 250, `hours=${afterNewEdit.operatingHours}`);

  // ----- failures: edit and remove
  const f1 = (await call('/api/failures', {
    method: 'POST',
    body: { machine: aId, date: '2026-01-05', failureMode: 'Bearing wear', severity: 'moderate', downtimeHours: 3 }
  })).payload.record;
  const editFailure = await call(`/api/failures/${f1._id}`, {
    method: 'PUT',
    body: { severity: 'critical', cause: 'Loss of lubrication', date: '2026-01-06' }
  });
  check(
    'PUT failure saves the edit',
    editFailure.status === 200 && editFailure.payload.record.severity === 'critical' && day(editFailure.payload.record.date) === '2026-01-06'
  );
  const delFailure = await call(`/api/failures/${f1._id}`, { method: 'DELETE' });
  const failuresLeft = await call(`/api/machines/${aId}/failures`);
  check('DELETE failure removes the row', delFailure.status === 200 && failuresLeft.payload.count === 0, `count=${failuresLeft.payload.count}`);
  const missing = await call(`/api/failures/${f1._id}`, { method: 'PUT', body: { severity: 'minor' } });
  check('editing a deleted record answers 404', missing.status === 404, `status=${missing.status}`);

  // ----- admin role management
  const list = await call('/api/auth/users');
  check('admin can list accounts', list.status === 200 && list.payload.count === 1 && list.payload.users[0].role === 'admin', `status=${list.status}`);

  const second = await call('/api/auth/register', {
    method: 'POST',
    body: { name: 'Verify Tech', email: 'verify.tech@test.local', username: 'verifytech', password: 'verifytech123' }
  });
  check('later registrations stay technician', second.status === 201 && second.payload.user.role === 'technician');
  token = reg.payload.token;

  const promote = await call(`/api/auth/users/${second.payload.user.id}/role`, { method: 'PUT', body: { role: 'admin' } });
  check('admin can promote another account', promote.status === 200 && promote.payload.user.role === 'admin');

  const login = await call('/api/auth/login', { method: 'POST', body: { identifier: 'verifytech', password: 'verifytech123' } });
  const techToken = login.payload.token;
  token = techToken;
  const demoteOther = await call(`/api/auth/users/${adminId}/role`, { method: 'PUT', body: { role: 'technician' } });
  check('a second admin can demote the first', demoteOther.status === 200 && demoteOther.payload.user.role === 'technician');

  const demoteSelf = await call(`/api/auth/users/${second.payload.user.id}/role`, { method: 'PUT', body: { role: 'viewer' } });
  check('last remaining admin cannot demote themselves', demoteSelf.status === 409, `status=${demoteSelf.status}`);

  const third = await call('/api/auth/register', {
    method: 'POST',
    body: { name: 'Verify Viewer', email: 'verify.viewer@test.local', username: 'verifyviewer', password: 'verifyviewer123' }
  });
  token = third.payload.token;
  const forbidden = await call('/api/auth/users');
  check('technician cannot list accounts', forbidden.status === 403, `status=${forbidden.status}`);
  const forbiddenRole = await call(`/api/auth/users/${adminId}/role`, { method: 'PUT', body: { role: 'admin' } });
  check('technician cannot change roles', forbiddenRole.status === 403, `status=${forbiddenRole.status}`);
  token = techToken;
  const badRole = await call(`/api/auth/users/${second.payload.user.id}/role`, { method: 'PUT', body: { role: 'superuser' } });
  check('unknown role is rejected by validation', badRole.status === 422, `status=${badRole.status}`);

  // ----- account deletion: admin only, last admin protected, records survive
  token = third.payload.token; // still a technician
  const forbiddenDelete = await call(`/api/auth/users/${adminId}`, { method: 'DELETE' });
  check('technician cannot delete an account', forbiddenDelete.status === 403, `status=${forbiddenDelete.status}`);

  token = techToken; // the second account is now the only admin left
  const lastAdminDelete = await call(`/api/auth/users/${second.payload.user.id}`, { method: 'DELETE' });
  check('last remaining admin cannot delete themselves', lastAdminDelete.status === 409, `status=${lastAdminDelete.status}`);

  const missingUser = await call('/api/auth/users/000000000000000000000000', { method: 'DELETE' });
  check('deleting an unknown account answers 404', missingUser.status === 404, `status=${missingUser.status}`);

  const deleteOther = await call(`/api/auth/users/${adminId}`, { method: 'DELETE' });
  check('admin can delete another account', deleteOther.status === 200 && deleteOther.payload.deleted === true, `status=${deleteOther.status}`);

  const afterDelete = await call('/api/auth/users');
  check(
    'deleted account disappears from the list',
    afterDelete.status === 200 && afterDelete.payload.users.every((u) => u.id !== adminId),
    `count=${afterDelete.payload.count}`
  );

  const machineStill = await getMachine();
  check(
    'records created by a deleted account survive and stay attributed',
    Boolean(machineStill && machineStill._id) && machineStill.createdBy === adminId,
    `createdBy=${machineStill && machineStill.createdBy}`
  );

  const relogin = await call('/api/auth/login', { method: 'POST', body: { identifier: 'verifyadmin', password: 'verifypw123' } });
  check('deleted account can no longer sign in', relogin.status === 401, `status=${relogin.status}`);
}

async function cleanup() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  const mongoose = require('mongoose');
  await mongoose.connect(uri);
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
  console.log('throwaway database dropped');
}

main()
  .then(async () => {
    await cleanup();
    console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    console.error('ERROR -', error && error.message ? error.message : error);
    try {
      await cleanup();
    } catch {
      /* the connection is already gone */
    }
    process.exit(1);
  });


