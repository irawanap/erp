const router = require('express').Router();
const controller = require('./report.controller');
const {
  requireAuth
} = require('../../shared/middlewares/authenticate');
const {
  requirePermission,
  requireRecentAuth
} = require('../../shared/middlewares/authorize');
router.use(requireAuth, requirePermission('reports:read'));
router.get('/leave-usage', controller.list);
router.get('/leave-usage/export', requireRecentAuth, controller.csv);
module.exports = router;
