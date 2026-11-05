const schema = require('./employee.validation');
const model = require('./employee.model');
module.exports = {
  list: (query, actor) => model.list(schema.query.parse(query), actor),
  get: (id, actor) => model.get(schema.id.parse(id), actor),
  create: (input, actor) => model.save(null, schema.create.parse(input), actor),
  update: (id, input, actor) => model.save(schema.id.parse(id), schema.update.parse(input), actor),
  status: (id, input, actor) => model.save(schema.id.parse(id), schema.status.parse(input), actor),
  link: (id, input, actor) => model.linkUser(schema.id.parse(id), schema.link.parse(input).employeeId, actor)
};
