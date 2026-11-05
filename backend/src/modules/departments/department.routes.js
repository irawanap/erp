const router = require('express').Router();
const controller = require('./department.controller');
const { requireAuth } = require('../../shared/middlewares/authenticate');
const { requirePermission, requireRecentAuth } = require('../../shared/middlewares/authorize');
const { requireCsrf } = require('../../shared/middlewares/csrf');

router.use(requireAuth);
router.get('/', requirePermission('departments:read'), controller.list);
router.get('/:id', requirePermission('departments:read'), controller.getById);
router.post('/', requirePermission('departments:write'), requireCsrf, requireRecentAuth, controller.create);
router.patch('/:id', requirePermission('departments:write'), requireCsrf, requireRecentAuth, controller.update);

module.exports = router;
