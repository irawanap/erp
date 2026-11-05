const userService = require('./user.service');

async function create(req, res) {
  const user = await userService.create(req.body, { id: req.user.id, version: req.session.user_version });
  res.status(201).json({ success: true, data: user });
}

async function list(req, res) {
  const result = await userService.list(req.query);
  res.json({ success: true, ...result });
}

async function getById(req, res) {
  const user = await userService.getById(req.params.id);
  res.json({ success: true, data: user });
}

async function update(req, res) {
  const user = await userService.update(req.params.id, req.body, { id: req.user.id, version: req.session.user_version });
  res.json({ success: true, data: user });
}

async function deactivate(req, res) {
  const user = await userService.deactivate(req.params.id, { id: req.user.id, version: req.session.user_version });
  res.json({ success: true, data: user });
}

module.exports = { create, list, getById, update, deactivate };
