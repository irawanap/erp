const router = require('express').Router();
const controller = require('./user.controller');
const { requireAuth } = require('../../shared/middlewares/authenticate');
const { requireCsrf } = require('../../shared/middlewares/csrf');
const { requirePermission, requireRecentAuth } = require('../../shared/middlewares/authorize');

router.use(requireAuth, requireCsrf);
router.post('/', requirePermission('users:write'), requireRecentAuth, controller.create);
router.get('/', requirePermission('users:read'), controller.list);
router.get('/:id', requirePermission('users:read'), controller.getById);
router.patch('/:id', requirePermission('users:write'), requireRecentAuth, controller.update);
router.delete('/:id', requirePermission('users:write'), requireRecentAuth, controller.deactivate);

router.patch('/:id/employee',requirePermission('users:write'),requireCsrf,requireRecentAuth,require('../employees/employee.controller').link);
module.exports = router;
