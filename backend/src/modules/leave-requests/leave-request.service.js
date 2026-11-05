const schema = require('./leave-request.validation');
const model = require('./leave-request.model');
const HttpError = require('../../shared/utils/http-error');

function parseQuery(input) {
  const query = schema.query.parse(input);
  if (query.startDate && query.endDate && query.startDate > query.endDate) {
    throw new HttpError(422, 'Rentang tanggal tidak valid');
  }
  return query;
}

module.exports = {
  list: (query, actor, pending = false) => model.list(parseQuery(query), actor, pending),
  get: (id, actor) => model.get(schema.id.parse(id), actor),
  create: (input, actor) => model.save(null, schema.create.parse(input), actor),
  update: (id, input, actor) => model.save(schema.id.parse(id), schema.update.parse(input), actor),
  transition: (id, action, input, actor) => model.transition(
    schema.id.parse(id), action,
    ['approve', 'reject'].includes(action) ? schema.decision.parse(input) : {}, actor,
  ),
};
