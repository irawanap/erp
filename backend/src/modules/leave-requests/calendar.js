const {
  HttpError
} = require('../../shared/utils/business');
function weekdays() {
  const values = (process.env.WORK_WEEKDAYS || '1,2,3,4,5').split(',').map(Number);
  if (!values.length || values.some(v => !Number.isInteger(v) || v < 0 || v > 6) || new Set(values).size !== values.length) throw new HttpError(503, 'WORK_WEEKDAYS tidak valid');
  return values;
}
async function days(db, start, end) {
  if (start > end || start.slice(0, 4) !== end.slice(0, 4)) throw new HttpError(422, 'Rentang tanggal harus berurutan dan dalam tahun yang sama');
  const {
    rows
  } = await db.query(`SELECT holiday_date::text FROM "TB_HOLIDAYS" WHERE is_active AND holiday_date BETWEEN $1 AND $2`, [start, end]);
  const holidays = new Set(rows.map(r => r.holiday_date));
  const working = weekdays();
  const result = [];
  for (let t = Date.parse(start + 'T00:00:00Z'); t <= Date.parse(end + 'T00:00:00Z'); t += 86400000) {
    const d = new Date(t);
    const key = d.toISOString().slice(0, 10);
    if (working.includes(d.getUTCDay()) && !holidays.has(key)) result.push(key);
  }
  if (!result.length) throw new HttpError(422, 'Rentang tidak memiliki hari kerja');
  return result;
}
module.exports = {
  days,
  weekdays
};
