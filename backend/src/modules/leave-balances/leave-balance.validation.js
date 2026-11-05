const {
  z,
  id,
  year,
  pagination
} = require('../../shared/validators/hr');
const create = z.object({
  employeeId: id,
  leaveTypeId: id,
  periodYear: year,
  entitlement: z.number().min(0).max(9999.99).multipleOf(0.5)
}).strict();
module.exports = {
  id,
  create,
  query: pagination.extend({
    employeeId: id.optional(),
    periodYear: year.optional()
  }).strict()
};
