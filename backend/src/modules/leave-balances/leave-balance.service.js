const schema = require('./leave-balance.validation');
const model = require('./leave-balance.model');

module.exports = {
  list: (query, actor) => model.list(schema.query.parse(query), actor),
  set: (input, actor) => model.set(schema.create.parse(input), actor),
};
