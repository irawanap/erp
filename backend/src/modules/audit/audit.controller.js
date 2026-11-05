const Audit = require('./audit.model');
const { pagination } = require('../../shared/validators/common');

async function list(req, res) {
  const query = pagination.parse(req.query);
  const result = await Audit.list(query);
  res.json({ success: true, ...result });
}

module.exports = { list };
