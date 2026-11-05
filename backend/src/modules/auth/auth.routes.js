const router = require('express').Router();
const controller = require('./auth.controller');
const { requireRecentAuth } = require('../../shared/middlewares/authorize');
const { requireAuth } = require('../../shared/middlewares/authenticate');
const { requireCsrf } = require('../../shared/middlewares/csrf');
const { throttle } = require('./auth-throttle.middleware');

router.get('/csrf', throttle('csrf-ip', 60, 300), controller.csrf);
router.post('/register', requireCsrf, throttle('register-ip', 5, 3600), controller.register);
router.post('/login', requireCsrf,
  throttle('login-ip', 30, 900), controller.validateLogin,
  throttle('login-email', 10, 900, (req) => req.loginInput.email), controller.login);
router.get('/me', requireAuth, controller.me);
router.post('/logout', requireAuth, requireCsrf, controller.logout);

const protectedMutation = [requireAuth, requireCsrf, throttle('sensitive-user', 10, 900, (req) => req.user.id)];
router.post('/reauthenticate', ...protectedMutation, controller.reauthenticate);
router.post('/change-password', ...protectedMutation, controller.changePassword);
router.get('/sessions', requireAuth, controller.sessions);
router.delete('/sessions/:id', requireAuth, requireCsrf, requireRecentAuth, controller.revokeSession);
router.post('/logout-all', requireAuth, requireCsrf, requireRecentAuth, controller.logoutAll);
router.post('/mfa/setup', ...protectedMutation, controller.setupMfa);
router.post('/mfa/confirm', ...protectedMutation, controller.confirmMfa);
router.post('/mfa/disable', ...protectedMutation, controller.disableMfa);

module.exports = router;
