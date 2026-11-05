const { roles, permissions } = require('./roles');

function listRoles(req, res) {
  res.json({ success: true, data: roles.map((role) => ({ role, permissions: permissions[role] })) });
}

module.exports = { listRoles };
