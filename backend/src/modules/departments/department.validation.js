const { z } = require('zod');
const { id, pagination } = require('../../shared/validators/common');

const fields = {
    code: z.string()
    .trim()
    .toUpperCase()
    .min(1, 'Kode departemen wajib diisi')
    .max(20, 'Kode departemen maksimal 20 karakter'),

    name: z.string()
    .trim()
    .min(1, 'Nama departemen wajib diisi')
    .max(100, 'Nama departemen maksimal 100 karakter'),
};

const create = z.object(fields).strict();

const update = z.object(fields)
    .partial()
    .strict()
    .refine(
        (value) => Object.keys(value).length > 0,
        'Minimal satu field harus terisi',
    );

const query = pagination.extend({
    search: z.string()
    .trim()
    .max(100, 'Pencarian maksimal 100 karakter')
    .default(''),
}).strict();

module.exports = {id, create, update, query};
