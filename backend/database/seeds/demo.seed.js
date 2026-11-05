const bcrypt = require('bcrypt');
const {
  randomBytes
} = require('node:crypto');
const calendar = require('../../src/modules/leave-requests/calendar');
const records = [['EMP001', 'Andi Saputra', 'OPS', 'Staff', '2025-01-06', 'EMP002', 'Employee', 'andi@example.test'], ['EMP002', 'Budi Santoso', 'OPS', 'Supervisor', '2023-04-03', null, 'Supervisor', 'budi@example.test'], ['EMP003', 'Citra Lestari', 'HRD', 'Staff', '2025-02-10', 'EMP004', 'Employee', 'citra@example.test'], ['EMP004', 'Dewi Anggraini', 'HRD', 'Manager', '2022-08-01', null, 'Supervisor', 'dewi@example.test'], ['EMP005', 'Eko Pratama', 'OPS', 'Staff', '2025-03-17', 'EMP002', 'Employee', 'eko@example.test']];
async function demo(client, year) {
  await require('./department.seed')(client);
  await require('./leave-type.seed')(client);
  const created = new Set();
  const employees = {};
  const credentials = [];
  for (const [nik, name, department, position, joinDate] of records) {
    const inserted = await client.query(`INSERT INTO "TB_EMPLOYEES" (nik,full_name,department_id,position,join_date)
   VALUES ($1,$2,(SELECT id FROM "TB_DEPARTMENT" WHERE code=$3),$4,$5) ON CONFLICT(nik) DO NOTHING RETURNING id`, [nik, name, department, position, joinDate]);
    if (inserted.rows[0]) created.add(nik);
    employees[nik] = (await client.query('SELECT * FROM "TB_EMPLOYEES" WHERE nik=$1', [nik])).rows[0];
  }
  const accounts = records.map(r => ({
    nik: r[0],
    email: r[7],
    role: r[6]
  }));
  accounts.push({
    nik: null,
    email: 'hrd.admin@example.test',
    role: 'HRD/Admin'
  });
  for (const account of accounts) {
    const password = randomBytes(20).toString('hex');
    const {
      rows
    } = await client.query(`INSERT INTO "TB_USERS" (email,password_hash,role,employee_id)
   VALUES ($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING public_id`, [account.email, await bcrypt.hash(password, 12), account.role, account.nik ? employees[account.nik].id : null]);
    if (rows[0]) credentials.push({
      email: account.email,
      password,
      role: account.role,
      id: rows[0].public_id
    });
  }
  for (const [nik,,,,, supervisor] of records) if (created.has(nik) && supervisor) await client.query('UPDATE "TB_EMPLOYEES" SET supervisor_id=$1 WHERE id=$2', [employees[supervisor].id, employees[nik].id]);
  const type = (await client.query(`SELECT * FROM "TB_LEAVE_TYPES" WHERE code='ANNUAL'`)).rows[0];
  for (const employee of Object.values(employees)) await client.query(`INSERT INTO "TB_LEAVE_BALANCES" (employee_id,leave_type_id,period_year,entitlement)
 VALUES ($1,$2,$3,12) ON CONFLICT(employee_id,leave_type_id,period_year) DO NOTHING`, [employee.id, type.id, year]);
  const monday = new Date(Date.UTC(year, 10, 1));
  while (monday.getUTCDay() !== 1) monday.setUTCDate(monday.getUTCDate() + 1);
  for (const [i, nik, status, length] of [[1, 'EMP001', 'Submitted', 3], [2, 'EMP005', 'Approved', 2], [3, 'EMP003', 'Rejected', 1]]) {
    const start = new Date(monday);
    start.setUTCDate(start.getUTCDate() + 7 * (i - 1));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + length - 1);
    const dates = await calendar.days(client, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    const employee = employees[nik];
    const approver = employees[records.find(r => r[0] === nik)[5]];
    const result = await client.query(`INSERT INTO "TB_LEAVE_REQUESTS" (request_no,employee_id,leave_type_id,start_date,end_date,total_days,reason,status,approver_id,submitted_at)
   VALUES ($1,$2,$3,$4,$5,$6,'Data simulasi technical test',$7,$8,CURRENT_TIMESTAMP) ON CONFLICT(request_no) DO NOTHING RETURNING id`, [`DEMO-${year}-${i}`, employee.id, type.id, dates[0], dates[dates.length - 1], dates.length, status, approver.id]);
    if (!result.rows[0]) continue;
    const requestId = result.rows[0].id;
    await client.query('INSERT INTO "TB_LEAVE_REQUEST_DAYS" (request_id,leave_date) SELECT $1,unnest($2::date[])', [requestId, dates]);
    if (status === 'Approved') await client.query(`UPDATE "TB_LEAVE_BALANCES" SET used_days=used_days+$1 WHERE employee_id=$2 AND leave_type_id=$3 AND period_year=$4`, [dates.length, employee.id, type.id, year]);
    if (status !== 'Submitted') await client.query(`INSERT INTO "TB_LEAVE_APPROVALS" (leave_request_id,approver_id,decision,comment) VALUES ($1,$2,$3,'Keputusan simulasi untuk demonstrasi')`, [requestId, approver.id, status]);
  }
  return credentials;
}
module.exports = demo;
