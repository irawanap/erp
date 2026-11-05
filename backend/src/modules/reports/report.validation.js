const {
  z,
  id,
  date,
  pagination
} = require('../../shared/validators/hr');
const fields = {
  startDate: date,
  endDate: date,
  departmentId: id.optional()
};
function range(v) {
  return v.startDate <= v.endDate && Date.parse(v.endDate) - Date.parse(v.startDate) < 366 * 86400000;
}
module.exports = {
  query: pagination.extend(fields).strict().refine(range, 'Rentang laporan maksimal 366 hari dan harus berurutan'),
  export: z.object(fields).strict().refine(range, 'Rentang laporan maksimal 366 hari dan harus berurutan')
};
