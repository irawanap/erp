const business = require('../../shared/utils/business');
const Audit = require('../audit/audit.model');
const columns = 'public_id AS id,code,name,requires_balance,is_active,created_at,updated_at';
const fields = {
  'code': 'code',
  'name': 'name',
  'requiresBalance': 'requires_balance',
  'isActive': 'is_active'
};
async function list(filters) {
  const values = [business.pattern(filters.search)];
  let where = '(code ILIKE $1 OR name ILIKE $1)';
  if (filters.isActive !== undefined) {
    values.push(filters.isActive);
    where += ' AND is_active=$2';
  }
  return business.page(business.pool, 'FROM "TB_LEAVE_TYPES"', columns, where, values, filters, 'code ASC');
}
async function get(id, db = business.pool) {
  const {
    rows
  } = await db.query(`SELECT ${columns} FROM "TB_LEAVE_TYPES" WHERE public_id=$1`, [id]);
  if (!rows[0]) throw new business.HttpError(404, 'Data tidak ditemukan');
  return rows[0];
}
async function save(id, data, actor) {
  return business.write(actor, 'leave-types:write', async (db, current) => {
    const old = id ? await business.reference(db, 'TB_LEAVE_TYPES', id, 'Data tidak ditemukan') : null;
    if (old && (data.requiresBalance !== undefined || data.isActive !== undefined)) {
      const pending = await db.query(`SELECT id FROM "TB_LEAVE_REQUESTS" WHERE leave_type_id=$1 AND status='Submitted' LIMIT 1`, [old.id]);
      if (pending.rows[0]) throw new business.HttpError(409, 'Selesaikan pengajuan pending sebelum mengubah kebijakan jenis cuti');
    }
    const entries = Object.entries(data);
    const values = entries.map(([, value]) => value);
    let result;
    if (!old) result = await db.query(`INSERT INTO "TB_LEAVE_TYPES" (${entries.map(([key]) => fields[key]).join(',')})
   VALUES (${values.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING public_id`, values);else {
      values.push(old.id);
      result = await db.query(`UPDATE "TB_LEAVE_TYPES" SET ${entries.map(([key], i) => fields[key] + '=$' + (i + 1)).join(',')}
    WHERE id=$${values.length} RETURNING public_id`, values);
    }
    const publicId = result.rows[0].public_id;
    await Audit.record('leave-type.' + (old ? 'updated' : 'created'), current.publicId, publicId, {
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
