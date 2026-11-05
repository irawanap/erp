jest.mock('pino-http', () => () => (req, res, next) => next());
const suite = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
suite('technical test ERP end-to-end with isolated PostgreSQL', () => {
  let database, pool, app, request, admin, andi, budi, citra, dewi, eko, type, employees, departments;
  async function login(credentials) {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/v1/auth/csrf');
    const result = await agent.post('/api/v1/auth/login').set('X-CSRF-Token', csrf.body.data.csrfToken).send({
      email: credentials.email,
      password: credentials.password
    });
    expect(result.status).toBe(200);
    return {
      agent,
      csrf: result.body.data.csrfToken,
      credentials,
      user: result.body.data.user
    };
  }
  function mutate(actor, method, path, body = {}) {
    return actor.agent[method]('/api/v1' + path).set('X-CSRF-Token', actor.csrf).send(body);
  }
  async function create(actor, start = '2030-01-07', end = '2030-01-09') {
    return mutate(actor, 'post', '/leave-requests', {
      leaveTypeId: type.id,
      startDate: start,
      endDate: end,
      reason: 'Personal matters'
    });
  }
  async function submit(actor, id) {
    return mutate(actor, 'post', `/leave-requests/${id}/submit`);
  }
  async function decide(actor, id, action = 'approve') {
    return mutate(actor, 'post', `/leave-requests/${id}/${action}`, {
      comment: 'Keputusan pengujian'
    });
  }
  beforeAll(async () => {
    process.env.SESSION_SECRET = 'erp-test-session-secret-at-least-32-bytes';
    process.env.REQUIRE_ADMIN_MFA = 'false';
    process.env.ENABLE_PUBLIC_REGISTRATION = 'false';
    process.env.WORK_WEEKDAYS = '1,2,3,4,5';
    database = await require('../helpers/database').createDatabase();
    pool = database.pool;
    const tx = require('../../src/shared/utils/transaction');
    const credentials = await tx(db => require('../../database/seeds/demo.seed')(db, 2030));
    app = require('../../src/app');
    request = require('supertest');
    const map = Object.fromEntries(credentials.map(c => [c.email, c]));
    admin = await login(map['hrd.admin@example.test']);
    andi = await login(map['andi@example.test']);
    budi = await login(map['budi@example.test']);
    citra = await login(map['citra@example.test']);
    dewi = await login(map['dewi@example.test']);
    eko = await login(map['eko@example.test']);
    type = (await admin.agent.get('/api/v1/leave-types')).body.data[0];
    employees = (await admin.agent.get('/api/v1/employees')).body.data;
    departments = (await admin.agent.get('/api/v1/departments')).body.data;
  }, 20000);
  afterAll(async () => {
    await database?.cleanup();
  });
  test('demo contains exact five required employees, twelve-day entitlement and is repeatable', async () => {
    expect(employees.map(e => e.nik)).toEqual(['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005']);
    const again = await require('../../src/shared/utils/transaction')(db => require('../../database/seeds/demo.seed')(db, 2030));
    expect(again).toEqual([]);
    const balances = await admin.agent.get('/api/v1/leave-balances?periodYear=2030');
    expect(balances.body.data).toHaveLength(5);
    expect(balances.body.data.every(b => b.entitlement === 12)).toBe(true);
    const ekoBalance = balances.body.data.find(b => b.employee_id === eko.user.employee_id);
    expect(ekoBalance.used_days).toBe(2);
  });
  test('employee and supervisor read scopes are enforced', async () => {
    expect((await andi.agent.get('/api/v1/employees')).body.data.map(e => e.nik)).toEqual(['EMP001']);
    expect((await budi.agent.get('/api/v1/employees')).body.data.map(e => e.nik)).toEqual(['EMP001', 'EMP002', 'EMP005']);
    expect((await andi.agent.get('/api/v1/employees/' + citra.user.employee_id)).status).toBe(404);
    expect((await budi.agent.get('/api/v1/employees/' + citra.user.employee_id + '/leave-balance')).status).toBe(404);
    expect(andi.user.employee_id).toMatch(/^[a-f0-9-]{36}$/);
  });
  test('HRD filters employees by department/status/search, others cannot mutate', async () => {
    const operation = departments.find(d => d.code === 'OPS');
    const result = await admin.agent.get('/api/v1/employees').query({
      departmentId: operation.id,
      status: 'Active',
      search: 'Andi'
    });
    expect(result.body.data.map(e => e.nik)).toEqual(['EMP001']);
    expect((await mutate(andi, 'patch', '/employees/' + andi.user.employee_id, {
      fullName: 'Not allowed'
    })).status).toBe(403);
    const duplicate = await mutate(admin, 'post', '/employees', {
      nik: 'EMP001',
      fullName: 'Duplicate',
      departmentId: operation.id,
      position: 'Staff',
      joinDate: '2020-01-01'
    });
    expect(duplicate.status).toBe(409);
  });
  test('linking accounts rejects duplicates and invalid employee references', async () => {
    const result = await mutate(admin, 'patch', `/users/${admin.user.id}/employee`, {
      employeeId: andi.user.employee_id
    });
    expect(result.status).toBe(409);
    expect((await mutate(admin, 'patch', `/users/${admin.user.id}/employee`, {
      employeeId: require('node:crypto').randomUUID()
    })).status).toBe(404);
  });
  test('employee hierarchy rejects self references, cycles and unsafe deactivation', async () => {
    expect((await mutate(admin, 'patch', '/employees/' + budi.user.employee_id, {
      supervisorId: budi.user.employee_id
    })).status).toBe(422);
    expect((await mutate(admin, 'patch', '/employees/' + budi.user.employee_id, {
      supervisorId: dewi.user.employee_id
    })).status).toBe(200);
    expect((await mutate(admin, 'patch', '/employees/' + dewi.user.employee_id, {
      supervisorId: budi.user.employee_id
    })).status).toBe(422);
    expect((await mutate(admin, 'patch', '/employees/' + budi.user.employee_id, {
      supervisorId: null
    })).status).toBe(200);
    expect((await mutate(admin, 'patch', '/employees/' + budi.user.employee_id + '/status', {
      employmentStatus: 'Inactive'
    })).status).toBe(409);
  });
  test('partial updates preserve unrelated defaults and empty patches are rejected', async () => {
    expect((await mutate(admin, 'patch', '/employees/' + andi.user.employee_id, {
      position: 'Senior Staff'
    })).status).toBe(200);
    const detail = await admin.agent.get('/api/v1/employees/' + andi.user.employee_id);
    expect(detail.body.data.supervisor_id).toBe(budi.user.employee_id);
    expect((await mutate(admin, 'patch', '/employees/' + andi.user.employee_id, {})).status).toBe(422);
    expect((await mutate(admin, 'patch', '/leave-types/' + type.id, {
      name: 'Annual Leave'
    })).status).toBe(200);
    expect((await mutate(admin, 'patch', '/leave-types/' + type.id, {})).status).toBe(422);
  });
  test('weekends and active holidays are excluded from calculated days', async () => {
    const holiday = await mutate(admin, 'post', '/holidays', {
      holidayDate: '2030-01-14',
      name: 'Company holiday'
    });
    expect(holiday.status).toBe(201);
    const result = await create(andi, '2030-01-11', '2030-01-14');
    expect(result.status).toBe(201);
    expect(result.body.data.total_days).toBe(1);
    expect(result.body.data.working_dates).toEqual(['2030-01-11']);
    expect((await create(andi, '2030-01-12', '2030-01-13')).status).toBe(422);
    await mutate(andi, 'post', `/leave-requests/${result.body.data.id}/cancel`);
  });
  test('reversed/cross-year dates and client-supplied totals are rejected', async () => {
    expect((await create(andi, '2030-01-09', '2030-01-07')).status).toBe(422);
    expect((await create(andi, '2030-12-31', '2031-01-02')).status).toBe(422);
    expect((await mutate(andi, 'post', '/leave-requests', {
      leaveTypeId: type.id,
      startDate: '2030-01-07',
      endDate: '2030-01-09',
      reason: 'Test',
      totalDays: 0
    })).status).toBe(422);
  });
  test('insufficient balance is rejected and used balance is server-controlled', async () => {
    expect((await create(andi, '2030-02-01', '2030-02-28')).status).toBe(409);
    expect((await mutate(admin, 'put', '/leave-balances', {
      employeeId: andi.user.employee_id,
      leaveTypeId: type.id,
      periodYear: 2030,
      entitlement: 12,
      usedDays: 0
    })).status).toBe(422);
  });
  test('draft can be edited; only assigned supervisor can decide; concurrent approval debits once', async () => {
    const created = await create(andi);
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await mutate(andi, 'patch', '/leave-requests/' + id, {
      reason: 'Updated reason'
    })).status).toBe(200);
    expect((await citra.agent.get('/api/v1/leave-requests/' + id)).status).toBe(404);
    const submitted = await submit(andi, id);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe('Submitted');
    expect((await submit(andi, id)).status).toBe(409);
    expect((await decide(andi, id)).status).toBe(403);
    expect((await decide(admin, id)).status).toBe(403);
    expect((await decide(dewi, id)).status).toBe(403);
    expect((await mutate(budi, 'post', `/leave-requests/${id}/approve`, {})).status).toBe(422);
    const pending = await budi.agent.get('/api/v1/approvals/pending');
    expect(pending.body.data.some(r => r.id === id)).toBe(true);
    const results = await Promise.all([decide(budi, id), decide(budi, id)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const detail = await andi.agent.get('/api/v1/leave-requests/' + id);
    expect(detail.body.data.approvals).toHaveLength(1);
    expect(detail.body.data.approvals[0]).toMatchObject({
      decision: 'Approved',
      comment: 'Keputusan pengujian',
      approver_id: budi.user.employee_id
    });
    expect(detail.body.data.approvals[0].decided_at).toBeTruthy();
    const balance = await andi.agent.get('/api/v1/leave-balances?periodYear=2030');
    expect(balance.body.data[0].used_days).toBe(3);
    expect((await create(andi, '2030-01-08', '2030-01-10')).status).toBe(409);
    expect((await mutate(andi, 'post', `/leave-requests/${id}/cancel`)).status).toBe(409);
    expect((await mutate(admin, 'put', '/leave-balances', {
      employeeId: andi.user.employee_id,
      leaveTypeId: type.id,
      periodYear: 2030,
      entitlement: 2
    })).status).toBe(409);
  });
  test('different concurrent requests cannot overdraw one balance', async () => {
    const first = await create(andi, '2030-07-01', '2030-07-08');
    const second = await create(andi, '2030-07-15', '2030-07-22');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await submit(andi, first.body.data.id)).status).toBe(200);
    expect((await submit(andi, second.body.data.id)).status).toBe(200);
    const results = await Promise.all([decide(budi, first.body.data.id), decide(budi, second.body.data.id)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const failed = results[0].status === 409 ? first.body.data.id : second.body.data.id;
    await mutate(andi, 'post', `/leave-requests/${failed}/cancel`);
    const balances = await andi.agent.get('/api/v1/leave-balances?periodYear=2030');
    expect(balances.body.data[0].used_days).toBe(9);
  });
  test('rejection and cancellation do not debit balance', async () => {
    const first = await create(citra, '2030-03-04', '2030-03-05');
    expect(first.status).toBe(201);
    const id = first.body.data.id;
    expect((await submit(citra, id)).status).toBe(200);
    expect((await decide(dewi, id, 'reject')).body.data.status).toBe('Rejected');
    expect((await submit(citra, id)).status).toBe(409);
    const second = await create(citra, '2030-03-06', '2030-03-07');
    expect((await submit(citra, second.body.data.id)).status).toBe(200);
    expect((await mutate(citra, 'post', `/leave-requests/${second.body.data.id}/cancel`)).body.data.status).toBe('Cancelled');
    const balance = await citra.agent.get('/api/v1/leave-balances?periodYear=2030');
    expect(balance.body.data[0].used_days).toBe(0);
  });
  test('approval revalidates balance after HRD adjustment', async () => {
    const draft = await create(eko, '2030-04-01', '2030-04-03');
    expect((await submit(eko, draft.body.data.id)).status).toBe(200);
    expect((await mutate(admin, 'put', '/leave-balances', {
      employeeId: eko.user.employee_id,
      leaveTypeId: type.id,
      periodYear: 2030,
      entitlement: 3
    })).status).toBe(200);
    expect((await decide(budi, draft.body.data.id)).status).toBe(409);
    await mutate(eko, 'post', `/leave-requests/${draft.body.data.id}/cancel`);
    await mutate(admin, 'put', '/leave-balances', {
      employeeId: eko.user.employee_id,
      leaveTypeId: type.id,
      periodYear: 2030,
      entitlement: 12
    });
  });
  test('supervisors cannot approve themselves and cannot submit without assigned supervisor', async () => {
    const draft = await create(budi, '2030-05-06', '2030-05-07');
    expect(draft.status).toBe(201);
    expect((await submit(budi, draft.body.data.id)).status).toBe(409);
    expect((await decide(budi, draft.body.data.id)).status).toBe(403);
  });
  test('calendar changes require resubmission instead of silently changing submitted days', async () => {
    const draft = await create(andi, '2030-06-03', '2030-06-05');
    expect((await submit(andi, draft.body.data.id)).status).toBe(200);
    await mutate(admin, 'post', '/holidays', {
      holidayDate: '2030-06-04',
      name: 'New holiday'
    });
    expect((await decide(budi, draft.body.data.id)).status).toBe(409);
    expect((await mutate(andi, 'post', `/leave-requests/${draft.body.data.id}/cancel`)).status).toBe(200);
  });
  test('reports use approved working dates within requested period; other roles cannot export', async () => {
    const report = await admin.agent.get('/api/v1/reports/leave-usage').query({
      startDate: '2030-01-08',
      endDate: '2030-01-08'
    });
    expect(report.status).toBe(200);
    expect(report.body.data[0]).toMatchObject({
      employee_id: andi.user.employee_id,
      used_days: 1
    });
    const file = await admin.agent.get('/api/v1/reports/leave-usage/export?startDate=2030-01-07&endDate=2030-01-09');
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('text/csv');
    expect(file.text).toContain('Andi Saputra');
    expect((await andi.agent.get('/api/v1/reports/leave-usage?startDate=2030-01-01&endDate=2030-12-31')).status).toBe(403);
    expect((await budi.agent.get('/api/v1/reports/leave-usage/export?startDate=2030-01-01&endDate=2030-12-31')).status).toBe(403);
  });
  test('dashboard is scoped and matches employee totals', async () => {
    const summary = await admin.agent.get('/api/v1/dashboard/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.data.activeEmployees).toBe(5);
    expect((await andi.agent.get('/api/v1/dashboard/summary')).body.data.activeEmployees).toBe(1);
    expect((await budi.agent.get('/api/v1/dashboard/summary')).body.data.activeEmployees).toBe(3);
    expect((await andi.agent.get('/api/v1/settings')).body.data.workWeekdays).toEqual([1, 2, 3, 4, 5]);
  });
  test('employee deactivation revokes login and retains leave history', async () => {
    const result = await mutate(admin, 'patch', '/employees/' + eko.user.employee_id + '/status', {
      employmentStatus: 'Inactive'
    });
    expect(result.status).toBe(200);
    expect((await eko.agent.get('/api/v1/auth/me')).status).toBe(401);
    const anonymous = request.agent(app);
    const csrf = await anonymous.get('/api/v1/auth/csrf');
    expect((await anonymous.post('/api/v1/auth/login').set('X-CSRF-Token', csrf.body.data.csrfToken).send({
      email: eko.credentials.email,
      password: eko.credentials.password
    })).status).toBe(401);
    const history = await admin.agent.get('/api/v1/leave-requests').query({
      employeeId: eko.user.employee_id
    });
    expect(history.body.data.some(r => r.status === 'Approved')).toBe(true);
  });
});
