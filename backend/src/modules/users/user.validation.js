const { z } = require('zod');

const { id, email, password, pagination } = require('../../shared/validators/common');
const fields = {
  email,
  password,
  role: z.enum(require('../access/roles').roles),
  isActive: z.boolean(),
};

const create = z.object({
  email: fields.email,
  password: fields.password,
  role: fields.role.default('Employee'),
}).strict();
const update = z.object(fields).partial().strict()
  .refine((value) => Object.keys(value).length > 0, 'Minimal satu field harus diisi');
const query = pagination.extend({
  search: z.string().trim().max(255).default(''),
  role: fields.role.optional(),
  isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
}).strict();

module.exports = { id, create, update, query };
