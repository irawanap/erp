const router = require('express').Router();

router.use('/auth', require('./modules/auth/auth.routes'));
router.use('/departments', require('./modules/departments/department.routes'));
router.use('/users', require('./modules/users/user.routes'));
router.use(require('./modules/access/access.routes'));
router.use('/audit-logs', require('./modules/audit/audit.routes'));

router.use('/employees', require('./modules/employees/employee.routes'));
router.use('/leave-types', require('./modules/leave-types/leave-type.routes'));
router.use('/holidays', require('./modules/holidays/holiday.routes'));
router.use('/leave-balances', require('./modules/leave-balances/leave-balance.routes'));
router.use('/leave-requests', require('./modules/leave-requests/leave-request.routes'));
router.use('/approvals', require('./modules/approvals/approval.routes'));
router.use('/dashboard', require('./modules/dashboard/dashboard.routes'));
router.use('/reports', require('./modules/reports/report.routes'));
router.get('/settings', require('./shared/middlewares/authenticate').requireAuth, require('./modules/dashboard/dashboard.controller').settings);
module.exports = router;
