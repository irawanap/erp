const schema = require('./holiday.validation');
const model = require('./holiday.model');
module.exports = {
  list: query => model.list(schema.query.parse(query)),
  get: id => model.get(schema.id.parse(id)),
  create: (input, actor) => model.save(null, schema.create.parse(input), actor),
  update: (id, input, actor) => model.save(schema.id.parse(id), schema.update.parse(input), actor)
};
