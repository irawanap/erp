const router = require('express').Router();
const controller = require('./audit.controller');
const { requireAuth } = require('../../shared/middlewares/authenticate');
const { requirePermission, requireRecentAuth } = require('../../shared/middlewares/authorize');

router.get('/', requireAuth, requirePermission('audit:read'), requireRecentAuth, controller.list);

module.exports = router;
