const Department = require('./department.model');
const schema = require('./department.validation');
const HttpError = require('../../shared/utils/http-error');

async function create(input, actor) {
    const data = schema.create.parse(input);
    return Department.create(data, actor);
}

async function list(query) {
    const filters = schema.query.parse(query);
    const { departments, total } = await Department.findAll(filters);

    return {
        data: departments,
        pagination: {
            page: filters.page,
            limit: filters.limit,
            total,
            totalPages: Math.ceil(total / filters.limit),
        },
    };
}

async function getById(id) {
    const departmentId = schema.id.parse(id);
    const department = await Department.findById(departmentId);

    if (!department) {
        throw new HttpError(404, 'Departemen tidak ditemukan');
    }

    return department;
}

async function update(id, input, actor) {
    const departmentId = schema.id.parse(id);
    const data = schema.update.parse(input);
    const department = await Department.update(departmentId, data, actor);

    if (!department) {
        throw new HttpError(404, 'Departemen tidak ditemukan');
    }

    return department;
}

module.exports = { create, list, getById, update };
