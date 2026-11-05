const {
  z
} = require('zod');
const {
  id,
  pagination
} = require('./common');
const date = z.iso.date();
const year = z.coerce.number().int().min(1900).max(2200);
const active = z.enum(['true', 'false']).transform(v => v === 'true').optional();
const query = pagination.extend({
  search: z.string().trim().max(150).default('')
}).strict();
function partial(schema) {
  return schema.partial().refine(v => Object.keys(v).length > 0, 'Minimal satu field wajib diisi');
}
module.exports = {
  z,
  id,
  pagination,
  date,
  year,
  active,
  query,
  partial
};
