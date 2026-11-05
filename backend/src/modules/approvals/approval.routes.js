const router = require('express').Router();
const {
  requireAuth
} = require('../../shared/middlewares/authenticate');
const {
  requirePermission
} = require('../../shared/middlewares/authorize');
router.get('/pending', requireAuth, requirePermission('approvals:write'), require('../leave-requests/leave-request.controller').pending);
module.exports = router;
