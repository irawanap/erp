const business = require('../../shared/utils/business');
async function summary(actor) {
  const scope = business.employeeScope(actor);
  const values = scope.values;
  const active = await business.pool.query(`SELECT COUNT(*)::int AS total FROM "TB_EMPLOYEES" e WHERE ${scope.sql} AND employment_status='Active'`, values);
  const departments = await business.pool.query(`SELECT d.public_id AS department_id,d.name,COUNT(*)::int AS total
 FROM "TB_EMPLOYEES" e JOIN "TB_DEPARTMENT" d ON d.id=e.department_id WHERE ${scope.sql} AND employment_status='Active' GROUP BY d.public_id,d.name ORDER BY d.name`, values);
  const statuses = await business.pool.query(`SELECT r.status,COUNT(*)::int AS total FROM "TB_LEAVE_REQUESTS" r JOIN "TB_EMPLOYEES" e ON e.id=r.employee_id WHERE ${scope.sql} GROUP BY r.status`, values);
  const counts = Object.fromEntries(['Draft', 'Submitted', 'Approved', 'Rejected', 'Cancelled'].map(s => [s, 0]));
  for (const row of statuses.rows) counts[row.status] = row.total;
  let pendingApproval = actor.role === 'HRD/Admin' ? counts.Submitted : 0;
  if (actor.role === 'Supervisor' && actor.employeeId) {
    const p = await business.pool.query(`SELECT COUNT(*)::int AS total FROM "TB_LEAVE_REQUESTS" r JOIN "TB_EMPLOYEES" e ON e.id=r.employee_id
 WHERE r.approver_id=$1 AND e.supervisor_id=$1 AND r.employee_id<>$1 AND r.status='Submitted'`, [actor.employeeId]);
    pendingApproval = p.rows[0].total;
  }
  return {
    activeEmployees: active.rows[0].total,
    employeesByDepartment: departments.rows,
    leaveRequestsByStatus: counts,
    pendingApproval
  };
}
module.exports = {
  summary
};
