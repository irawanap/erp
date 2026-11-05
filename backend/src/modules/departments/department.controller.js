const service = require('./department.service');

async function list(req, res) {
  const result = await service.list(req.query);
  res.json({ success: true, ...result });
}

async function getById(req, res) {
  const department = await service.getById(req.params.id);
  res.json({ success: true, data: department });
}

async function create(req, res) {
  const department = await service.create(req.body, { id: req.user.id, version: req.session.user_version });
  res.status(201).json({ success: true, data: department });
}

async function update(req, res) {
  const department = await service.update(req.params.id, req.body, { id: req.user.id, version: req.session.user_version });
  res.json({ success: true, data: department });
}

module.exports = { list, getById, create, update };
