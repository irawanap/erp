const router = require('express').Router();
const controller = require('./holiday.controller');
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
router.get('/', requirePermission('holidays:read'), controller.list);
router.get('/:id', requirePermission('holidays:read'), controller.get);
router.post('/', requirePermission('holidays:write'), requireCsrf, requireRecentAuth, controller.create);
router.patch('/:id', requirePermission('holidays:write'), requireCsrf, requireRecentAuth, controller.update);
module.exports = router;
