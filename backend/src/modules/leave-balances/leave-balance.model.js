const business = require('../../shared/utils/business');
const Audit = require('../audit/audit.model');
const from = `FROM "TB_LEAVE_BALANCES" b JOIN "TB_EMPLOYEES" e ON e.id=b.employee_id JOIN "TB_LEAVE_TYPES" t ON t.id=b.leave_type_id`;
const columns = `b.public_id AS id,e.public_id AS employee_id,e.full_name,t.public_id AS leave_type_id,t.name AS leave_type_name,
 b.period_year,b.entitlement::float8,b.used_days::float8,(b.entitlement-b.used_days)::float8 AS available_days,b.updated_at`;
async function list(filters, actor) {
  const scope = business.employeeScope(actor);
  const values = [...scope.values];
  const conditions = [scope.sql];
  if (filters.employeeId) {
    values.push(filters.employeeId);
    conditions.push(`e.public_id=$${values.length}`);
  }
  if (filters.periodYear) {
    values.push(filters.periodYear);
    conditions.push(`b.period_year=$${values.length}`);
  }
  return business.page(business.pool, from, columns, conditions.join(' AND '), values, filters, 'e.nik,b.period_year DESC,t.code');
}
async function set(data, actor) {
  return business.write(actor, 'leave-balances:write', async (db, current) => {
    const employee = await business.reference(db, 'TB_EMPLOYEES', data.employeeId, 'Karyawan tidak ditemukan');
    const type = await business.reference(db, 'TB_LEAVE_TYPES', data.leaveTypeId, 'Jenis cuti tidak ditemukan');
    if (!type.requires_balance) throw new business.HttpError(422, 'Jenis cuti ini tidak memakai saldo');
    const existing = await db.query(`SELECT used_days FROM "TB_LEAVE_BALANCES" WHERE employee_id=$1 AND leave_type_id=$2 AND period_year=$3 FOR UPDATE`, [employee.id, type.id, data.periodYear]);
    if (existing.rows[0] && Number(existing.rows[0].used_days) > data.entitlement) throw new business.HttpError(409, 'Hak cuti tidak boleh lebih kecil dari penggunaan');
    const {
      rows
    } = await db.query(`INSERT INTO "TB_LEAVE_BALANCES" (employee_id,leave_type_id,period_year,entitlement)
   VALUES ($1,$2,$3,$4) ON CONFLICT(employee_id,leave_type_id,period_year) DO UPDATE SET entitlement=EXCLUDED.entitlement RETURNING public_id`, [employee.id, type.id, data.periodYear, data.entitlement]);
    await Audit.record('leave-balance.set', current.publicId, rows[0].public_id, {
      periodYear: data.periodYear,
      entitlement: data.entitlement
    }, db);
    const result = await db.query(`SELECT ${columns} ${from} WHERE b.public_id=$1`, [rows[0].public_id]);
    return result.rows[0];
  });
}
module.exports = {
  list,
  set
};
