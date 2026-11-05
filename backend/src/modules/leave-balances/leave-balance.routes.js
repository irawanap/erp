const router = require('express').Router();
const controller = require('./leave-balance.controller');
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
router.get('/', requirePermission('leave-balances:read'), controller.list);
router.put('/', requirePermission('leave-balances:write'), requireCsrf, requireRecentAuth, controller.set);
module.exports = router;
