const schema = require('./report.validation');
const model = require('./report.model');
const Audit = require('../audit/audit.model');
function cell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
async function csv(input, actor) {
  const query = schema.export.parse(input);
  const rows = await model.exportRows(query);
  await Audit.record('report.exported', actor.publicId, null, {
    ...query,
    rows: rows.length
  });
  const keys = ['nik', 'full_name', 'department_name', 'leave_type_name', 'used_days'];
  return '\uFEFF' + [keys.map(cell).join(','), ...rows.map(row => keys.map(key => cell(row[key])).join(','))].join('\r\n') + '\r\n';
}
module.exports = {
  list: q => model.list(schema.query.parse(q)),
  csv
};
