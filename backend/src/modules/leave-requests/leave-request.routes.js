const router = require('express').Router();
const controller = require('./leave-request.controller');
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
router.get('/', requirePermission('leave-requests:read'), controller.list);
router.get('/:id', requirePermission('leave-requests:read'), controller.get);
router.post('/', requirePermission('leave-requests:write'), requireCsrf, controller.create);
router.patch('/:id', requirePermission('leave-requests:write'), requireCsrf, controller.update);
router.post('/:id/submit', requirePermission('leave-requests:write'), requireCsrf, controller.submit);
router.post('/:id/cancel', requirePermission('leave-requests:write'), requireCsrf, controller.cancel);
router.post('/:id/approve', requirePermission('approvals:write'), requireCsrf, requireRecentAuth, controller.approve);
router.post('/:id/reject', requirePermission('approvals:write'), requireCsrf, requireRecentAuth, controller.reject);
module.exports = router;
