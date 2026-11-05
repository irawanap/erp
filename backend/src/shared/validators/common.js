const { z } = require('zod');

const id = z.uuidv4('ID harus berupa UUID v4').toLowerCase();
const email = z.string().trim().toLowerCase().email().max(255);
const password = z.string().min(15).refine(
  (value) => Buffer.byteLength(value, 'utf8') <= 72,
  'Password maksimal 72 byte',
);
const pagination = z.object({
  page: z.string().regex(/^[1-9]\d*$/).default('1').transform(Number)
    .pipe(z.number().int().max(1000000)),
  limit: z.string().regex(/^[1-9]\d*$/).default('10').transform(Number)
    .pipe(z.number().int().max(100)),
}).strict();

module.exports = { id, email, password, pagination };
