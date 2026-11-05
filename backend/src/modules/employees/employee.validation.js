const {
  z,
  id,
  date,
  query,
  partial
} = require('../../shared/validators/hr');
const status = z.enum(['Active', 'Inactive', 'Resigned']);
const create = z.object({
  nik: z.string().trim().toUpperCase().min(1).max(30),
  fullName: z.string().trim().min(1).max(150),
  departmentId: id,
  position: z.string().trim().min(1).max(100),
  supervisorId: id.nullable().default(null),
  joinDate: date,
  employmentStatus: status.default('Active')
}).strict();
module.exports = {
  id,
  create,
  update: partial(create.omit({
    supervisorId: true,
    employmentStatus: true
  }).extend({
    supervisorId: id.nullable(),
    employmentStatus: status
  })),
  status: z.object({
    employmentStatus: status
  }).strict(),
  query: query.extend({
    departmentId: id.optional(),
    status: status.optional()
  }).strict(),
  link: z.object({
    employeeId: id.nullable()
  }).strict()
};
