const {
  z,
  id,
  date,
  year,
  query,
  partial
} = require('../../shared/validators/hr');
const create = z.object({
  holidayDate: date,
  name: z.string().trim().min(1).max(150),
  isActive: z.boolean().default(true)
}).strict();
module.exports = {
  id,
  create,
  update: partial(create.omit({
    isActive: true
  }).extend({
    isActive: z.boolean()
  })),
  query: query.extend({
    year: year.optional(),
    isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional()
  }).strict()
};
