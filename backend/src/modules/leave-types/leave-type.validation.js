const {
  z,
  id,
  date,
  query,
  partial
} = require('../../shared/validators/hr');
const create = z.object({
  code: z.string().trim().toUpperCase().min(1).max(30),
  name: z.string().trim().min(1).max(100),
  requiresBalance: z.boolean().default(true),
  isActive: z.boolean().default(true)
}).strict();
module.exports = {
  id,
  create,
  update: partial(create.omit({
    requiresBalance: true,
    isActive: true
  }).extend({
    requiresBalance: z.boolean(),
    isActive: z.boolean()
  })),
  query: query.extend({
    isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional()
  }).strict()
};
