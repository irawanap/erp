const service = require('./leave-request.service');
const {
  context
} = require('../../shared/utils/business');
async function list(req, res) {
  res.json({
    success: true,
    ...(await service.list(req.query, context(req)))
  });
}
async function get(req, res) {
  res.json({
    success: true,
    data: await service.get(req.params.id, context(req))
  });
}
async function create(req, res) {
  res.status(201).json({
    success: true,
    data: await service.create(req.body, context(req))
  });
}
async function update(req, res) {
  res.json({
    success: true,
    data: await service.update(req.params.id, req.body, context(req))
  });
}
function action(name) {
  return async (req, res) => res.json({
    success: true,
    data: await service.transition(req.params.id, name, req.body, context(req))
  });
}
async function pending(req, res) {
  res.json({
    success: true,
    ...(await service.list(req.query, context(req), true))
  });
}
module.exports = {
  list,
  get,
  create,
  update,
  submit: action('submit'),
  cancel: action('cancel'),
  approve: action('approve'),
  reject: action('reject'),
  pending
};
