const { query, exec } = require('../config/db');
const { AppError } = require('../utils/http');

exports.list = async (req, res) => {
  const r = await query(
    `SELECT TOP 200 * FROM ThongBao WHERE MaNguoiDung=@u ${req.query.chuaDoc ? 'AND DaDoc=0' : ''} ORDER BY ThoiGianTao DESC, MaThongBao DESC`,
    { u: req.user.MaNguoiDung }
  );
  res.json(r.recordset);
};

exports.unreadCount = async (req, res) => {
  const r = await query('SELECT COUNT(*) n FROM ThongBao WHERE MaNguoiDung=@u AND DaDoc=0', { u: req.user.MaNguoiDung });
  res.json({ chuaDoc: r.recordset[0].n });
};

exports.markRead = async (req, res) => {
  const r = await query('SELECT MaNguoiDung FROM ThongBao WHERE MaThongBao=@id', { id: Number(req.params.id) });
  if (!r.recordset[0]) throw new AppError(404, 'Không tìm thấy thông báo.');
  if (r.recordset[0].MaNguoiDung !== req.user.MaNguoiDung) throw new AppError(403, 'Thông báo không thuộc về bạn.');
  await query('UPDATE ThongBao SET DaDoc=1 WHERE MaThongBao=@id', { id: Number(req.params.id) });
  res.json({ message: 'Đã đánh dấu đã đọc.' });
};

exports.markAllRead = async (req, res) => {
  await query('UPDATE ThongBao SET DaDoc=1 WHERE MaNguoiDung=@u AND DaDoc=0', { u: req.user.MaNguoiDung });
  res.json({ message: 'Đã đánh dấu tất cả là đã đọc.' });
};

/** Chạy thủ công job nhắc lịch nhận xe (demo) */
exports.runReminder = async (req, res) => {
  const r = await exec('sp_TaoThongBaoSapNhanXe');
  res.json({ message: `Đã tạo ${r.recordset[0]?.SoThongBao ?? 0} thông báo nhắc lịch nhận xe.` });
};
