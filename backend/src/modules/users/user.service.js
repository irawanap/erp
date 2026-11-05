const bcrypt = require('bcrypt');
const User = require('./user.model');
const schema = require('./user.validation');
const HttpError = require('../../shared/utils/http-error');

async function create(input, actor) {
  const { password, ...data } = schema.create.parse(input);
  data.passwordHash = await bcrypt.hash(password, 12);
  return User.create(data, actor);
}

async function list(query) {
  const filters = schema.query.parse(query);
  const { users, total } = await User.findAll(filters);
  return {
    data: users,
    pagination: {
      page: filters.page, limit: filters.limit, total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

async function getById(id) {
  const user = await User.findById(schema.id.parse(id));
  if (!user) throw new HttpError(404, 'User tidak ditemukan');
  return user;
}

async function update(id, input, actor) {
  const userId = schema.id.parse(id);
  const { password, ...data } = schema.update.parse(input);
  if (password !== undefined) data.passwordHash = await bcrypt.hash(password, 12);
  const user = await User.update(userId, data, actor);
  if (!user) throw new HttpError(404, 'User tidak ditemukan');
  return user;
}

async function deactivate(id, actor) {
  return update(id, { isActive: false }, actor);
}

module.exports = { create, list, getById, update, deactivate };
