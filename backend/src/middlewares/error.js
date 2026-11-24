const { AppError } = require('../utils/http');

const CONFLICT = new Set([52106, 52203, 52813]);
const FORBIDDEN = new Set([52402, 52803, 52812]);
const NOT_FOUND = new Set([52104, 52200, 52300, 52400, 52500, 52600, 52700, 52802, 52811, 52903, 52950, 53002]);

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  // Lỗi nghiệp vụ ném từ stored procedure (THROW 5xxxx)
  const num = err.number || err.originalError?.info?.number;
  if (num && num >= 50000) {
    const status = CONFLICT.has(num) ? 409 : FORBIDDEN.has(num) ? 403 : NOT_FOUND.has(num) ? 404 : 400;
    return res.status(status).json({ message: err.message, code: num });
  }
  if (num === 2627 || num === 2601) {
    return res.status(409).json({ message: 'Dữ liệu bị trùng (email, số điện thoại, biển số... đã tồn tại).', code: num });
  }
  if (num === 547) {
    return res.status(400).json({ message: 'Dữ liệu vi phạm ràng buộc (giá trị không hợp lệ hoặc đang được tham chiếu).', code: num });
  }
  if (err.code === 'ESOCKET' || err.code === 'ELOGIN' || err.code === 'ETIMEOUT') {
    console.error('[DB]', err.message);
    return res.status(503).json({ message: 'Không kết nối được SQL Server. Kiểm tra cấu hình .env.' });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: `Lỗi upload: ${err.message}` });
  }
  console.error(err);
  res.status(500).json({ message: 'Lỗi hệ thống.', error: process.env.NODE_ENV === 'production' ? undefined : err.message });
}

module.exports = { errorHandler };
