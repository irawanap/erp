const router = require('express').Router();
const controller = require('./leave-type.controller');
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
router.get('/', requirePermission('leave-types:read'), controller.list);
router.get('/:id', requirePermission('leave-types:read'), controller.get);
router.post('/', requirePermission('leave-types:write'), requireCsrf, requireRecentAuth, controller.create);
router.patch('/:id', requirePermission('leave-types:write'), requireCsrf, requireRecentAuth, controller.update);
module.exports = router;
