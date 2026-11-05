const {
  z,
  id,
  date,
  pagination,
  partial
} = require('../../shared/validators/hr');
const fields = {
  leaveTypeId: id,
  startDate: date,
  endDate: date,
  reason: z.string().trim().min(1).max(2000)
};
const create = z.object(fields).strict();
const status = z.enum(['Draft', 'Submitted', 'Approved', 'Rejected', 'Cancelled']);
module.exports = {
  id,
  create,
  update: partial(create),
  decision: z.object({
    comment: z.string().trim().min(1).max(2000)
  }).strict(),
  query: pagination.extend({
    status: status.optional(),
    employeeId: id.optional(),
    departmentId: id.optional(),
    startDate: date.optional(),
    endDate: date.optional()
  }).strict()
};
