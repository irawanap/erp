const router = require('express').Router();
const controller = require('./access.controller');
const { requireAuth } = require('../../shared/middlewares/authenticate');
const { requirePermission } = require('../../shared/middlewares/authorize');

router.get('/roles', requireAuth, requirePermission('roles:read'), controller.listRoles);

module.exports = router;
