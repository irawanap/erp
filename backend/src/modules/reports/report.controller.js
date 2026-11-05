const service = require('./report.service');
const {
  context
} = require('../../shared/utils/business');
async function list(req, res) {
  res.json({
    success: true,
    ...(await service.list(req.query))
  });
}
async function csv(req, res) {
  const text = await service.csv(req.query, context(req));
  res.type('text/csv').attachment('leave-usage.csv').send(text);
}
module.exports = {
  list,
  csv
};
