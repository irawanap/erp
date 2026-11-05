const business = require('../../shared/utils/business');
function parts(q) {
  const values = [q.startDate, q.endDate];
  let where = `r.status='Approved' AND days.leave_date BETWEEN $1 AND $2`;
  if (q.departmentId) {
    values.push(q.departmentId);
    where += ' AND d.public_id=$3';
  }
  const from = `FROM "TB_LEAVE_REQUESTS" r JOIN "TB_LEAVE_REQUEST_DAYS" days ON days.request_id=r.id
 JOIN "TB_EMPLOYEES" e ON e.id=r.employee_id JOIN "TB_DEPARTMENT" d ON d.id=e.department_id
 JOIN "TB_LEAVE_TYPES" t ON t.id=r.leave_type_id`;
  const group = 'e.public_id,e.nik,e.full_name,d.public_id,d.name,t.public_id,t.name';
  const columns = `e.public_id AS employee_id,e.nik,e.full_name,d.public_id AS department_id,d.name AS department_name,
 t.public_id AS leave_type_id,t.name AS leave_type_name,COUNT(*)::int AS used_days`;
  return {
    values,
    where,
    from,
    group,
    columns
  };
}
async function list(q) {
  const p = parts(q);
  const count = await business.pool.query(`SELECT COUNT(*)::int AS total FROM (SELECT e.id ${p.from} WHERE ${p.where} GROUP BY ${p.group},e.id) totals`, p.values);
  const {
    rows
  } = await business.pool.query(`SELECT ${p.columns} ${p.from} WHERE ${p.where} GROUP BY ${p.group}
 ORDER BY d.name,e.nik,t.name LIMIT $${p.values.length + 1} OFFSET $${p.values.length + 2}`, [...p.values, q.limit, (q.page - 1) * q.limit]);
  const total = count.rows[0].total;
  return {
    data: rows,
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit)
    }
  };
}
async function exportRows(q) {
  const p = parts(q);
  const {
    rows
  } = await business.pool.query(`SELECT ${p.columns} ${p.from} WHERE ${p.where} GROUP BY ${p.group} ORDER BY d.name,e.nik,t.name LIMIT 10001`, p.values);
  if (rows.length > 10000) throw new business.HttpError(422, 'Persempit filter: maksimal 10000 baris ekspor');
  return rows;
}
module.exports = {
  list,
  exportRows
};
