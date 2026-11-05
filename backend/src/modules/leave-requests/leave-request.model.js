const {
  randomUUID
} = require('node:crypto');
const business = require('../../shared/utils/business');
const Audit = require('../audit/audit.model');
const calendar = require('./calendar');
const from = `FROM "TB_LEAVE_REQUESTS" r JOIN "TB_EMPLOYEES" e ON e.id=r.employee_id
 JOIN "TB_DEPARTMENT" d ON d.id=e.department_id JOIN "TB_LEAVE_TYPES" t ON t.id=r.leave_type_id
 LEFT JOIN "TB_EMPLOYEES" a ON a.id=r.approver_id`;
const columns = `r.public_id AS id,r.request_no,e.public_id AS employee_id,e.nik,e.full_name,d.public_id AS department_id,d.name AS department_name,
 t.public_id AS leave_type_id,t.name AS leave_type_name,r.start_date::text,r.end_date::text,r.total_days::float8,r.reason,r.status,
 a.public_id AS approver_id,a.full_name AS approver_name,r.submitted_at,r.created_at,r.updated_at`;
function filters(query, actor, pending) {
  const scope = business.employeeScope(actor);
  const values = [...scope.values];
  const conditions = [scope.sql];
  for (const [key, column] of [['status', 'r.status'], ['employeeId', 'e.public_id'], ['departmentId', 'd.public_id']]) if (query[key]) {
    values.push(query[key]);
    conditions.push(`${column}=$${values.length}`);
  }
  if (query.startDate) {
    values.push(query.startDate);
    conditions.push(`r.end_date >= $${values.length}`);
  }
  if (query.endDate) {
    values.push(query.endDate);
    conditions.push(`r.start_date <= $${values.length}`);
  }
  if (pending) {
    values.push(actor.employeeId || null);
    conditions.push(`r.approver_id=$${values.length} AND e.supervisor_id=$${values.length} AND r.status='Submitted' AND r.employee_id<>$${values.length}`);
  }
  return {
    where: conditions.join(' AND '),
    values
  };
}
async function list(query, actor, pending = false) {
  const f = filters(query, actor, pending);
  return business.page(business.pool, from, columns, f.where, f.values, query, 'r.created_at DESC,r.id DESC');
}
async function get(id, actor, db = business.pool) {
  const scope = business.employeeScope(actor);
  const values = [...scope.values, id];
  const {
    rows
  } = await db.query(`SELECT ${columns} ${from} WHERE ${scope.sql} AND r.public_id=$${values.length}`, values);
  if (!rows[0]) throw new business.HttpError(404, 'Pengajuan tidak ditemukan');
  const decisions = await db.query(`SELECT p.public_id AS id,e.public_id AS approver_id,e.full_name AS approver_name,p.decision,p.comment,p.decided_at
 FROM "TB_LEAVE_APPROVALS" p JOIN "TB_EMPLOYEES" e ON e.id=p.approver_id
 WHERE p.leave_request_id=(SELECT id FROM "TB_LEAVE_REQUESTS" WHERE public_id=$1) ORDER BY p.decided_at`, [id]);
  const dates = await db.query(`SELECT leave_date::text FROM "TB_LEAVE_REQUEST_DAYS" WHERE request_id=(SELECT id FROM "TB_LEAVE_REQUESTS" WHERE public_id=$1) ORDER BY leave_date`, [id]);
  return {
    ...rows[0],
    approvals: decisions.rows,
    working_dates: dates.rows.map(r => r.leave_date)
  };
}
async function validate(db, employee, type, data, exclude = null) {
  if (employee.employment_status !== 'Active' || !type.is_active) throw new business.HttpError(422, 'Karyawan dan jenis cuti harus aktif');
  if (data.startDate < employee.join_date) throw new business.HttpError(422, 'Tanggal cuti sebelum tanggal masuk');
  const dates = await calendar.days(db, data.startDate, data.endDate);
  const overlap = await db.query(`SELECT id FROM "TB_LEAVE_REQUESTS" WHERE employee_id=$1 AND status='Approved'
 AND start_date <= $2 AND end_date >= $3 AND ($4::bigint IS NULL OR id<>$4) LIMIT 1`, [employee.id, data.endDate, data.startDate, exclude]);
  if (overlap.rows[0]) throw new business.HttpError(409, 'Tanggal bertumpang tindih dengan cuti disetujui');
  let balance;
  if (type.requires_balance) {
    const result = await db.query(`SELECT * FROM "TB_LEAVE_BALANCES" WHERE employee_id=$1 AND leave_type_id=$2 AND period_year=$3 FOR UPDATE`, [employee.id, type.id, Number(data.startDate.slice(0, 4))]);
    balance = result.rows[0];
    if (!balance || Number(balance.entitlement) - Number(balance.used_days) < dates.length) throw new business.HttpError(409, 'Saldo cuti tidak mencukupi');
  }
  return {
    dates,
    balance
  };
}
async function replaceDays(db, requestId, dates) {
  await db.query('DELETE FROM "TB_LEAVE_REQUEST_DAYS" WHERE request_id=$1', [requestId]);
  await db.query('INSERT INTO "TB_LEAVE_REQUEST_DAYS" (request_id,leave_date) SELECT $1,unnest($2::date[])', [requestId, dates]);
}
async function save(id, input, actor) {
  return business.write(actor, 'leave-requests:write', async (db, current) => {
    if (!current.employeeId) throw new business.HttpError(403, 'Hubungkan akun dengan karyawan terlebih dahulu');
    const employee = (await db.query('SELECT * FROM "TB_EMPLOYEES" WHERE id=$1', [current.employeeId])).rows[0];
    const old = id ? await business.reference(db, 'TB_LEAVE_REQUESTS', id, 'Pengajuan tidak ditemukan') : null;
    if (old && old.employee_id !== employee.id) throw new business.HttpError(404, 'Pengajuan tidak ditemukan');
    if (old && old.status !== 'Draft') throw new business.HttpError(409, 'Hanya draft dapat diubah');
    const data = {
      leaveTypeId: input.leaveTypeId,
      startDate: input.startDate || old?.start_date,
      endDate: input.endDate || old?.end_date,
      reason: input.reason ?? old?.reason
    };
    const type = input.leaveTypeId ? await business.reference(db, 'TB_LEAVE_TYPES', input.leaveTypeId, 'Jenis cuti tidak ditemukan') : (await db.query('SELECT * FROM "TB_LEAVE_TYPES" WHERE id=$1', [old.leave_type_id])).rows[0];
    const checked = await validate(db, employee, type, data, old?.id);
    let result;
    if (!old) result = await db.query(`INSERT INTO "TB_LEAVE_REQUESTS" (request_no,employee_id,leave_type_id,start_date,end_date,total_days,reason)
   VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,public_id`, ['LV-' + randomUUID(), employee.id, type.id, data.startDate, data.endDate, checked.dates.length, data.reason]);else result = await db.query(`UPDATE "TB_LEAVE_REQUESTS" SET leave_type_id=$1,start_date=$2,end_date=$3,total_days=$4,reason=$5 WHERE id=$6 RETURNING id,public_id`, [type.id, data.startDate, data.endDate, checked.dates.length, data.reason, old.id]);
    const request = result.rows[0];
    await replaceDays(db, request.id, checked.dates);
    await Audit.record(old ? 'leave.draft_updated' : 'leave.created', current.publicId, request.public_id, {}, db);
    return get(request.public_id, current, db);
  });
}
async function transition(id, action, input, actor) {
  const permission = ['approve', 'reject'].includes(action) ? 'approvals:write' : 'leave-requests:write';
  return business.write(actor, permission, async (db, current) => {
    const request = await business.reference(db, 'TB_LEAVE_REQUESTS', id, 'Pengajuan tidak ditemukan');
    const employee = (await db.query('SELECT * FROM "TB_EMPLOYEES" WHERE id=$1', [request.employee_id])).rows[0];
    const decision = ['approve', 'reject'].includes(action);
    if (decision) {
      if (!current.employeeId || request.employee_id === current.employeeId || request.approver_id !== current.employeeId || employee.supervisor_id !== current.employeeId) throw new business.HttpError(403, 'Bukan approver yang ditugaskan');
      if (request.status !== 'Submitted') throw new business.HttpError(409, 'Pengajuan sudah diproses atau belum disubmit');
    } else if (request.employee_id !== current.employeeId) throw new business.HttpError(404, 'Pengajuan tidak ditemukan');
    let next;
    if (action === 'cancel') {
      if (!['Draft', 'Submitted'].includes(request.status)) throw new business.HttpError(409, 'Status tidak dapat dibatalkan');
      next = 'Cancelled';
    } else if (action === 'reject') {
      next = 'Rejected';
    } else {
      if (action === 'submit' && request.status !== 'Draft') throw new business.HttpError(409, 'Hanya draft dapat disubmit');
      const type = (await db.query('SELECT * FROM "TB_LEAVE_TYPES" WHERE id=$1', [request.leave_type_id])).rows[0];
      const checked = await validate(db, employee, type, {
        startDate: request.start_date,
        endDate: request.end_date
      }, request.id);
      if (action === 'submit') {
        const approver = await db.query(`SELECT e.id FROM "TB_EMPLOYEES" e JOIN "TB_USERS" u ON u.employee_id=e.id
     WHERE e.id=$1 AND e.employment_status='Active' AND u.is_active AND u.role='Supervisor'`, [employee.supervisor_id]);
        if (!approver.rows[0]) throw new business.HttpError(409, 'Atasan aktif dengan akun Supervisor belum ditetapkan');
        await db.query('UPDATE "TB_LEAVE_REQUESTS" SET approver_id=$1,submitted_at=CURRENT_TIMESTAMP,total_days=$2 WHERE id=$3', [employee.supervisor_id, checked.dates.length, request.id]);
        await replaceDays(db, request.id, checked.dates);
        next = 'Submitted';
      } else {
        const saved = await db.query('SELECT leave_date::text FROM "TB_LEAVE_REQUEST_DAYS" WHERE request_id=$1 ORDER BY leave_date', [request.id]);
        if (JSON.stringify(saved.rows.map(r => r.leave_date)) !== JSON.stringify(checked.dates)) throw new business.HttpError(409, 'Kalender berubah; batalkan dan buat pengajuan baru');
        if (checked.balance) await db.query('UPDATE "TB_LEAVE_BALANCES" SET used_days=used_days+$1 WHERE id=$2', [checked.dates.length, checked.balance.id]);
        next = 'Approved';
      }
    }
    await db.query('UPDATE "TB_LEAVE_REQUESTS" SET status=$1 WHERE id=$2', [next, request.id]);
    if (decision) await db.query(`INSERT INTO "TB_LEAVE_APPROVALS" (leave_request_id,approver_id,decision,comment) VALUES ($1,$2,$3,$4)`, [request.id, current.employeeId, next, input.comment]);
    await Audit.record('leave.' + action, current.publicId, id, {
      status: next
    }, db);
    return get(id, current, db);
  });
}
module.exports = {
  list,
  get,
  save,
  transition,
  from,
  columns,
  filters
};
