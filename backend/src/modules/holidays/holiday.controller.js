const service = require('./holiday.service');
const {
  context
} = require('../../shared/utils/business');
async function list(req, res) {
  res.json({
    success: true,
    ...(await service.list(req.query))
  });
}
async function get(req, res) {
  res.json({
    success: true,
    data: await service.get(req.params.id)
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
module.exports = {
  list,
  get,
  create,
  update
};
