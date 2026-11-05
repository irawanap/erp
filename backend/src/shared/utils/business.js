const pool = require('../../../config/database');
const transaction = require('./transaction');
const HttpError = require('./http-error');
const {
  hasPermission
} = require('../../modules/access/roles');
function context(req) {
  return {
    userId: req.session.user_id,
    version: req.session.user_version,
    publicId: req.user.id,
    role: req.user.role,
    employeeId: req.session.employee_id
  };
}
async function write(actor, permission, work) {
  return transaction(async client => {
    // One lock coordinates HR/calendar/balance/request changes; keep these transactions short.
    await client.query('SELECT pg_advisory_xact_lock(73188002)');
    const {
      rows
    } = await client.query(`SELECT u.id, u.public_id, u.role, u.employee_id FROM "TB_USERS" u
       LEFT JOIN "TB_EMPLOYEES" e ON e.id = u.employee_id
       WHERE u.id = $1 AND u.auth_version = $2 AND u.is_active
       AND (u.employee_id IS NULL OR e.employment_status = 'Active') FOR SHARE OF u`, [actor.userId, actor.version]);
    if (!rows[0]) throw new HttpError(401, 'Akun berubah, login ulang');
    if (!hasPermission(rows[0].role, permission)) throw new HttpError(403, 'Anda tidak memiliki izin');
    return work(client, {
      ...actor,
      role: rows[0].role,
      employeeId: rows[0].employee_id
    });
  }, actor.publicId);
}
async function reference(db, table, publicId, message) {
  const tables = new Set(['TB_USERS', 'TB_DEPARTMENT', 'TB_EMPLOYEES', 'TB_LEAVE_TYPES', 'TB_HOLIDAYS', 'TB_LEAVE_REQUESTS']);
  if (!tables.has(table)) throw new Error('Unsupported reference table');
  const {
    rows
  } = await db.query(`SELECT * FROM "${table}" WHERE public_id = $1`, [publicId]);
  if (!rows[0]) throw new HttpError(404, message);
  return rows[0];
}
function employeeScope(actor, alias = 'e') {
  if (actor.role === 'HRD/Admin') return {
    sql: 'TRUE',
    values: []
  };
  if (!actor.employeeId) return {
    sql: 'FALSE',
    values: []
  };
  return {
    sql: actor.role === 'Supervisor' ? `(${alias}.id = $1 OR ${alias}.supervisor_id = $1)` : `${alias}.id = $1`,
    values: [actor.employeeId]
  };
}
async function page(db, from, columns, where, values, filters, order) {
  const count = await db.query(`SELECT COUNT(*)::int AS total ${from} WHERE ${where}`, values);
  const {
    rows
  } = await db.query(`SELECT ${columns} ${from} WHERE ${where} ORDER BY ${order}
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, filters.limit, (filters.page - 1) * filters.limit]);
  const total = count.rows[0].total;
  return {
    data: rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit)
    }
  };
}
function pattern(value) {
  return `%${value.replace(/[\\%_]/g, c => '\\' + c)}%`;
}
module.exports = {
  pool,
  context,
  write,
  reference,
  employeeScope,
  page,
  pattern,
  HttpError
};
