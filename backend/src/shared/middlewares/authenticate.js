const Session = require('../../modules/auth/session.model');
const HttpError = require('../utils/http-error');

async function requireAuth(req, res, next) {
  const session = req.session;
  if (!session?.user_id) throw new HttpError(401, 'Silakan login terlebih dahulu');
  req.user = {
    id: session.id, employee_id: session.employee_public_id || null, email: session.email,
    role: session.role, is_active: session.is_active, last_login_at: session.last_login_at,
    created_at: session.user_created_at, updated_at: session.updated_at,
  };
  await Session.touch(session.token_hash);
  next();
}

module.exports = { requireAuth };
