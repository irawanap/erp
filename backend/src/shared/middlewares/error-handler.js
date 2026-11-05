const { ZodError } = require('zod');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      message: 'Validasi gagal',
      errors: err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
  }
  if (err.constraint === 'tb_users_last_admin') {
    return res.status(409).json({ success: false, message: 'Admin aktif terakhir harus dipertahankan' });
  }
  if (err.code === '23505' && err.constraint === 'TB_DEPARTMENT_code_key') {
    return res.status(409).json({ success: false, message: 'Kode departemen sudah digunakan' });
  }
  const conflicts = { TB_EMPLOYEES_nik_key: 'NIK sudah digunakan', TB_LEAVE_TYPES_code_key: 'Kode jenis cuti sudah digunakan', TB_HOLIDAYS_holiday_date_key: 'Tanggal libur sudah digunakan', TB_USERS_employee_id_key: 'Karyawan sudah memiliki akun' };
  if (err.code === '23505' && conflicts[err.constraint]) return res.status(409).json({success:false,message:conflicts[err.constraint]});
  if (err.code === '23503') return res.status(409).json({success:false,message:'Data masih digunakan atau referensi tidak tersedia'});
  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Email atau employee sudah digunakan' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Format JSON tidak valid' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Payload terlalu besar' });
  }
  const status = err.status || 500;
  if (status >= 500) req.log?.error({ code: err.code || 'INTERNAL_ERROR', type: err.name }, 'Request gagal');
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : err.message,
  });
}

module.exports = errorHandler;
