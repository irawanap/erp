const service = require('./leave-balance.service');
const {
  context
} = require('../../shared/utils/business');
async function list(req, res) {
  res.json({
    success: true,
    ...(await service.list(req.query, context(req)))
  });
}
async function set(req, res) {
  res.json({
    success: true,
    data: await service.set(req.body, context(req))
  });
}
async function employee(req, res) {
  const {
    id
  } = require('../../shared/validators/common');
  const employeeId = id.parse(req.params.id);
  // Check access before listing so an inaccessible employee cannot be probed through balances.
  await require('../employees/employee.service').get(employeeId, context(req));
  res.json({
    success: true,
    ...(await service.list({
      ...req.query,
      employeeId
    }, context(req)))
  });
}
module.exports = {
  list,
  set,
  employee
};
