const business = require('../../shared/utils/business');
const Audit = require('../audit/audit.model');
const columns = `e.public_id AS id,e.nik,e.full_name,d.public_id AS department_id,d.name AS department_name,
 e.position,s.public_id AS supervisor_id,s.full_name AS supervisor_name,e.join_date::text,e.employment_status,e.created_at,e.updated_at`;
const from = `FROM "TB_EMPLOYEES" e JOIN "TB_DEPARTMENT" d ON d.id=e.department_id LEFT JOIN "TB_EMPLOYEES" s ON s.id=e.supervisor_id`;
async function list(filters, actor) {
  const scope = business.employeeScope(actor);
  const values = [...scope.values];
  const conditions = [scope.sql];
  if (filters.search) {
    values.push(business.pattern(filters.search));
    conditions.push(`(e.nik ILIKE $${values.length} OR e.full_name ILIKE $${values.length})`);
  }
  if (filters.departmentId) {
    values.push(filters.departmentId);
    conditions.push(`d.public_id=$${values.length}`);
  }
  if (filters.status) {
    values.push(filters.status);
    conditions.push(`e.employment_status=$${values.length}`);
  }
  return business.page(business.pool, from, columns, conditions.join(' AND '), values, filters, 'e.nik ASC');
}
async function get(id, actor, db = business.pool) {
  const scope = business.employeeScope(actor);
  const values = [...scope.values, id];
  const {
    rows
  } = await db.query(`SELECT ${columns} ${from} WHERE ${scope.sql} AND e.public_id=$${values.length}`, values);
  if (!rows[0]) throw new business.HttpError(404, 'Karyawan tidak ditemukan');
  return rows[0];
}
async function save(id, data, actor) {
  return business.write(actor, 'employees:write', async (db, currentActor) => {
    const old = id ? await business.reference(db, 'TB_EMPLOYEES', id, 'Karyawan tidak ditemukan') : null;
    const department = data.departmentId ? await business.reference(db, 'TB_DEPARTMENT', data.departmentId, 'Departemen tidak ditemukan') : null;
    let supervisor;
    if (data.supervisorId) {
      supervisor = await business.reference(db, 'TB_EMPLOYEES', data.supervisorId, 'Atasan tidak ditemukan');
      const account = await db.query(`SELECT id FROM "TB_USERS" WHERE employee_id=$1 AND role='Supervisor' AND is_active`, [supervisor.id]);
      if (supervisor.employment_status !== 'Active' || !account.rows[0]) throw new business.HttpError(422, 'Atasan harus aktif dan memiliki akun Supervisor');
      if (old) {
        const chain = await db.query(`WITH RECURSIVE chain AS (
          SELECT id,supervisor_id FROM "TB_EMPLOYEES" WHERE id=$1 UNION
          SELECT e.id,e.supervisor_id FROM "TB_EMPLOYEES" e JOIN chain c ON e.id=c.supervisor_id)
          SELECT id FROM chain WHERE id=$2`, [supervisor.id, old.id]);
        if (chain.rows.length) throw new business.HttpError(422, 'Relasi atasan membentuk siklus');
      }
    }
    if (old && data.supervisorId !== undefined) {
      const pending = await db.query(`SELECT id FROM "TB_LEAVE_REQUESTS" WHERE employee_id=$1 AND status='Submitted' LIMIT 1`, [old.id]);
      if (pending.rows[0]) throw new business.HttpError(409, 'Selesaikan pengajuan pending sebelum mengganti atasan');
    }
    if (old && data.employmentStatus && data.employmentStatus !== 'Active') {
      const blockers = await db.query(`SELECT id FROM "TB_USERS" WHERE employee_id=$1 AND role='HRD/Admin' AND is_active
        UNION ALL SELECT id FROM "TB_EMPLOYEES" WHERE supervisor_id=$1 AND employment_status='Active'
        UNION ALL SELECT id FROM "TB_LEAVE_REQUESTS" WHERE (employee_id=$1 OR approver_id=$1) AND status='Submitted' LIMIT 1`, [old.id]);
      if (blockers.rows[0]) throw new business.HttpError(409, 'Alihkan tim, selesaikan approval, dan lepaskan akun admin aktif terlebih dahulu');
    }
    let result;
    if (!old) result = await db.query(`INSERT INTO "TB_EMPLOYEES" (nik,full_name,department_id,position,supervisor_id,join_date,employment_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING public_id`, [data.nik, data.fullName, department.id, data.position, supervisor?.id || null, data.joinDate, data.employmentStatus]);else {
      const columns = {
        nik: 'nik',
        fullName: 'full_name',
        position: 'position',
        joinDate: 'join_date',
        employmentStatus: 'employment_status'
      };
      const changes = Object.entries(data).filter(([key]) => columns[key]).map(([key, value]) => [columns[key], value]);
      if (department) changes.push(['department_id', department.id]);
      if (data.supervisorId !== undefined) changes.push(['supervisor_id', supervisor?.id || null]);
      const values = changes.map(([, value]) => value);
      values.push(old.id);
      result = await db.query(`UPDATE "TB_EMPLOYEES" SET ${changes.map(([key], i) => `${key}=$${i + 1}`).join(',')}
        WHERE id=$${values.length} RETURNING public_id`, values);
    }
    const publicId = result.rows[0].public_id;
    await Audit.record(old ? 'employee.updated' : 'employee.created', currentActor.publicId, publicId, {
      fields: Object.keys(data)
    }, db);
    return get(publicId, currentActor, db);
  });
}
async function linkUser(userId, employeeId, actor) {
  return business.write(actor, 'users:write', async (db, currentActor) => {
    const user = await business.reference(db, 'TB_USERS', userId, 'User tidak ditemukan');
    const employee = employeeId ? await business.reference(db, 'TB_EMPLOYEES', employeeId, 'Karyawan tidak ditemukan') : null;
    if (employee && employee.employment_status !== 'Active') throw new business.HttpError(422, 'Karyawan harus aktif');
    if (user.employee_id && user.employee_id !== employee?.id) {
      const pending = await db.query(`SELECT id FROM "TB_LEAVE_REQUESTS" WHERE (employee_id=$1 OR approver_id=$1) AND status='Submitted' LIMIT 1`, [user.employee_id]);
      if (pending.rows[0]) throw new business.HttpError(409, 'Selesaikan pengajuan terkait sebelum memindahkan akun');
    }
    await db.query('UPDATE "TB_USERS" SET employee_id=$1 WHERE id=$2', [employee?.id || null, user.id]);
    await Audit.record('user.employee_linked', currentActor.publicId, userId, {
      employeeId
    }, db);
    return {
      id: userId,
      employee_id: employee?.public_id || null
    };
  });
}
module.exports = {
  list,
  get,
  save,
  linkUser
};
