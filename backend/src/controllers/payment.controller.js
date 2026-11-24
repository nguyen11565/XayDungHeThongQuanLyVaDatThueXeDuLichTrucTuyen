const { query, exec, sql } = require('../config/db');
const { AppError, toNumber, requireText, optText } = require('../utils/http');

/** UC09 - Khách tạo giao dịch (DEPOSIT / FULL) qua SANDBOX hoặc BANK_TRANSFER */
exports.create = async (req, res) => {
  const r = await exec('sp_TaoGiaoDichThanhToan', {
    MaDonThue: toNumber(req.body.maDonThue, 'mã đơn', { integer: true }),
    MaNguoiDung: req.user.MaNguoiDung,
    LoaiThanhToan: requireText(req.body.loaiThanhToan, 'loại thanh toán'),
    PhuongThuc: requireText(req.body.phuongThuc || 'SANDBOX', 'phương thức'),
  });
  res.status(201).json(r.recordset[0]);
};

exports.getOne = async (req, res) => {
  const r = await query(
    `SELECT T.*,D.MaKhachHang,D.TongTienPhaiTra,X.TenXe,X.BienSo FROM ThanhToan T
     JOIN DonThue D ON D.MaDonThue=T.MaDonThue JOIN Xe X ON X.MaXe=D.MaXe WHERE T.MaThanhToan=@id`,
    { id: Number(req.params.id) }
  );
  const p = r.recordset[0];
  if (!p) throw new AppError(404, 'Không tìm thấy giao dịch.');
  if (p.MaKhachHang !== req.user.MaNguoiDung && !req.user.permissions.includes('PAYMENT_PROCESS')) {
    throw new AppError(403, 'Bạn không có quyền xem giao dịch này.');
  }
  res.json(p);
};

/** Cổng thanh toán sandbox gọi lại kết quả (mô phỏng) */
exports.sandboxResult = async (req, res) => {
  const ketQua = requireText(req.body.ketQua, 'kết quả');
  const r = await exec('sp_XuLyKetQuaThanhToan', {
    MaThanhToan: Number(req.params.id), KetQua: ketQua, MaNguoiXuLy: req.user.MaNguoiDung, LaNhanVien: false,
    GhiChu: ketQua === 'FAILED' ? (optText(req.body.lyDo) || 'Sandbox: thẻ bị từ chối') : ketQua === 'CANCELLED' ? 'Khách huỷ thanh toán' : 'Sandbox: giao dịch thành công',
  });
  const p = r.recordset[0];
  console.log(`[SANDBOX] Giao dịch ${p.MaGiaoDich} - Đơn #${p.MaDonThue} - ${p.SoTien} - ${p.TrangThai}`);
  res.json(p);
};

/** UC16 - Nhân viên xác nhận giao dịch chuyển khoản đang chờ */
exports.verify = async (req, res) => {
  const r = await exec('sp_XuLyKetQuaThanhToan', {
    MaThanhToan: Number(req.params.id), KetQua: requireText(req.body.ketQua, 'kết quả'),
    MaNguoiXuLy: req.user.MaNguoiDung, LaNhanVien: true, GhiChu: optText(req.body.ghiChu),
  });
  res.json(r.recordset[0]);
};

/** Nhân viên ghi nhận thanh toán tại quầy */
exports.counter = async (req, res) => {
  const soTien = toNumber(req.body.soTien, 'số tiền', { min: 1 });
  await exec('sp_GhiNhanThanhToan', {
    MaDonThue: toNumber(req.body.maDonThue, 'mã đơn', { integer: true }),
    SoTien: { type: sql.Decimal(18, 2), value: soTien },
    LoaiThanhToan: requireText(req.body.loaiThanhToan || 'FULL', 'loại'),
    PhuongThuc: requireText(req.body.phuongThuc || 'CASH', 'phương thức'),
    TrangThai: req.body.trangThai || 'SUCCESS',
    MaGiaoDich: `${req.body.phuongThuc === 'BANK_TRANSFER' ? 'BNK' : 'CASH'}${Date.now()}`,
    MaNhanVienXacNhan: req.user.MaNguoiDung,
    GhiChu: optText(req.body.ghiChu),
  });
  res.status(201).json({ message: 'Đã ghi nhận thanh toán.' });
};

exports.list = async (req, res) => {
  const { trangThai, q } = req.query;
  const where = []; const p = {};
  if (trangThai) { where.push('T.TrangThai=@tt'); p.tt = trangThai; }
  if (q) { where.push('(T.MaGiaoDich LIKE @q OR CAST(T.MaDonThue AS VARCHAR(20))=@qx OR K.HoTen LIKE @q)'); p.q = `%${q}%`; p.qx = q; }
  const r = await query(
    `SELECT TOP 500 T.*,K.HoTen TenKhachHang,X.BienSo,N.HoTen TenNhanVien FROM ThanhToan T
     JOIN DonThue D ON D.MaDonThue=T.MaDonThue JOIN NguoiDung K ON K.MaNguoiDung=D.MaKhachHang
     JOIN Xe X ON X.MaXe=D.MaXe LEFT JOIN NguoiDung N ON N.MaNguoiDung=T.MaNhanVienXacNhan
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY T.MaThanhToan DESC`, p);
  res.json(r.recordset);
};
