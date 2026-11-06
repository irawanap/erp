const business = require('../../shared/utils/business');
const Audit = require('../audit/audit.model');
const columns = 'public_id AS id,holiday_date::text AS holiday_date,name,is_active,created_at,updated_at';
const fields = {
  'holidayDate': 'holiday_date',
  'name': 'name',
  'isActive': 'is_active'
};
async function list(filters) {
  const values = [business.pattern(filters.search)];
  let where = '(name ILIKE $1)';
  if (filters.isActive !== undefined) {
    values.push(filters.isActive);
    where += ` AND is_active=$${values.length}`;
  }
  if (filters.year !== undefined) {
    values.push(`${filters.year}-01-01`, `${filters.year + 1}-01-01`);
    where += ` AND holiday_date >= $${values.length - 1}::date AND holiday_date < $${values.length}::date`;
  }
  return business.page(business.pool, 'FROM "TB_HOLIDAYS"', columns, where, values, filters, 'holiday_date ASC');
}
async function get(id, db = business.pool) {
  const {
    rows
  } = await db.query(`SELECT ${columns} FROM "TB_HOLIDAYS" WHERE public_id=$1`, [id]);
  if (!rows[0]) throw new business.HttpError(404, 'Data tidak ditemukan');
  return rows[0];
}
async function save(id, data, actor) {
  return business.write(actor, 'holidays:write', async (db, current) => {
    const old = id ? await business.reference(db, 'TB_HOLIDAYS', id, 'Data tidak ditemukan') : null;
    const entries = Object.entries(data);
    const values = entries.map(([, value]) => value);
    let result;
    if (!old) result = await db.query(`INSERT INTO "TB_HOLIDAYS" (${entries.map(([key]) => fields[key]).join(',')})
   VALUES (${values.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING public_id`, values);else {
      values.push(old.id);
      result = await db.query(`UPDATE "TB_HOLIDAYS" SET ${entries.map(([key], i) => fields[key] + '=$' + (i + 1)).join(',')}
    WHERE id=$${values.length} RETURNING public_id`, values);
    }
    const publicId = result.rows[0].public_id;
    await Audit.record('holiday.' + (old ? 'updated' : 'created'), current.publicId, publicId, {
      fields: Object.keys(data)
    }, db);
    return get(publicId, db);
  });
}
module.exports = {
  list,
  get,
  save
};
