require('dotenv').config();

const pool = require('../config/database');
const seedDepartments = require('../database/seeds/department.seed');
const seedLeaveTypes = require('../database/seeds/leave-type.seed');

async function seed() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await seedDepartments(client);
        await seedLeaveTypes(client);

        await client.query('COMMIT');
        console.log('seed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

seed()
    .catch((error) => {
        console.error('seed error:', error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());