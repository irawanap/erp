const router = require('express').Router();
const controller = require('./employee.controller');
const {
  requireAuth
} = require('../../shared/middlewares/authenticate');
const {
  requirePermission,
  requireRecentAuth
} = require('../../shared/middlewares/authorize');
const {
  requireCsrf
} = require('../../shared/middlewares/csrf');
router.use(requireAuth);
router.get('/', requirePermission('employees:read'), controller.list);
router.get('/:id', requirePermission('employees:read'), controller.get);
router.post('/', requirePermission('employees:write'), requireCsrf, requireRecentAuth, controller.create);
router.patch('/:id', requirePermission('employees:write'), requireCsrf, requireRecentAuth, controller.update);
router.patch('/:id/status', requirePermission('employees:write'), requireCsrf, requireRecentAuth, controller.status);
router.get('/:id/leave-balance', requirePermission('leave-balances:read'), require('../leave-balances/leave-balance.controller').employee);
module.exports = router;
