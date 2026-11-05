require('dotenv').config();

const app = require('./src/app');
const pool = require('./config/database');

const PORT = process.env.PORT || 3000;

(async () => {
    try {
        const auth = require('./config/auth');
        auth.secret();
        if (auth.production()) {
            auth.encryptionKey();
            const origins = require('./src/shared/middlewares/security').allowedOrigins();
            if (!origins.length || origins.some((origin) => !origin.startsWith('https://'))) {
                throw new Error('Production CORS_ORIGIN harus memakai origin HTTPS');
            }
        }
        require('./src/modules/leave-requests/calendar').weekdays();
        await pool.query('SELECT 1');
        console.log('PostgreSQL connected successfully');

        app.listen(PORT, () => {
        console.log(`API running on http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('DB connection failed:', e.message);
        await pool.end();
        process.exit(1);
    }
})();
