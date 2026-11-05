const router = require('express').Router();
const controller = require('./dashboard.controller');
const {
  requireAuth
} = require('../../shared/middlewares/authenticate');
const {
  requirePermission
} = require('../../shared/middlewares/authorize');
router.get('/summary', requireAuth, requirePermission('dashboard:read'), controller.summary);
module.exports = router;
