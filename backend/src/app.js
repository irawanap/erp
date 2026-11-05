require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const { randomUUID } = require('node:crypto');
const rateLimit = require('express-rate-limit');
const { security, allowedOrigins } = require('./shared/middlewares/security');
const { loadSession } = require('./modules/auth/session.middleware');

const app = express();
app.disable('x-powered-by');
// Only configure addresses of proxies that you control; never trust arbitrary forwarded headers.
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY.split(',').map((value) => value.trim()));
app.use(helmet());
app.use(pinoHttp({
  genReqId: () => randomUUID(),
  serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url.split('?')[0] }) },
  redact: [
    'req.headers.authorization', 'req.headers.cookie', 'req.headers["x-csrf-token"]',
    'res.headers["set-cookie"]',
  ],
}));
app.use('/api', security);
app.use(cors({ origin: allowedOrigins(), credentials: true, exposedHeaders: ['Content-Disposition', 'Retry-After'] }));
app.use('/api', rateLimit({
  windowMs: 5 * 60 * 1000, limit: 300,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak request, coba lagi nanti' },
}));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/v1', loadSession, require('./routes'));

app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));
app.use(require('./shared/middlewares/error-handler'));

module.exports = app;
