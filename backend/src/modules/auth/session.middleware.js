const config = require('../../../config/auth');
const Session = require('./session.model');
const tokens = require('./session-token');

async function loadSession(req, res, next) {
  config.secret();
  const token = req.cookies[config.cookieName()];
  if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
    const session = await Session.find(tokens.hash(token));
    if (session) {
      req.session = session;
      req.sessionToken = token;
    }
  }
  next();
}

async function issueSession(res, user = null) {
  const token = tokens.generate();
  const session = await Session.create(tokens.hash(token), user);
  res.cookie(config.cookieName(), token, {
    ...config.cookieOptions(), expires: new Date(session.expires_at),
  });
  return tokens.csrf(token);
}

function clearCookie(res) {
  res.clearCookie(config.cookieName(), config.cookieOptions());
}

module.exports = { loadSession, issueSession, clearCookie };
