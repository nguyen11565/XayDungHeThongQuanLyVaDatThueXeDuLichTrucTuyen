const { query } = require('../config/db');
const { hasPerm } = require('../middlewares/auth');
const { writeAudit } = require('../utils/audit');
const { AppError, requireText } = require('../utils/http');

const SELECT = `
  SELECT H.*,D.MaKhachHang,D.TrangThai TrangThaiDon,D.NgayGioNhan,D.NgayGioTra,D.TongTienPhaiTra,
         K.HoTen TenKhachHang,X.TenXe,X.BienSo,N.HoTen TenNhanVienLap
  FROM HopDong H JOIN DonThue D ON D.MaDonThue=H.MaDonThue
  JOIN NguoiDung K ON K.MaNguoiDung=D.MaKhachHang JOIN Xe X ON X.MaXe=D.MaXe
  LEFT JOIN NguoiDung N ON N.MaNguoiDung=H.MaNhanVienLap`;

exports.list = async (req, res) => {
  const { trangThai, q } = req.query;
  const where = []; const p = {};
  if (trangThai) { where.push('H.TrangThai=@tt'); p.tt = trangThai; }
  if (q) { where.push('(H.SoHopDong LIKE @q OR K.HoTen LIKE @q OR X.BienSo LIKE @q)'); p.q = `%${q}%`; }
  const r = await query(`SELECT TOP 500 * FROM (${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}) T ORDER BY T.MaHopDong DESC`, p);
  res.json(r.recordset.map(({ NoiDung, ...x }) => x));
};

exports.byOrder = async (req, res) => {
  const r = await query(`${SELECT} WHERE H.MaDonThue=@id`, { id: Number(req.params.orderId) });
  const h = r.recordset[0];
  if (!h) throw new AppError(404, 'Đơn chưa có hợp đồng (hợp đồng được tạo khi nhân viên xác nhận đơn).');
  if (!hasPerm(req.user, 'CONTRACT_MANAGE', 'ORDER_PROCESS') && h.MaKhachHang !== req.user.MaNguoiDung) {
    throw new AppError(403, 'Bạn không có quyền xem hợp đồng này.');
  }
  res.json(h);
};

/** Chỉ sửa nội dung khi hợp đồng còn DRAFT */
exports.update = async (req, res) => {
  const id = Number(req.params.id);
  const noiDung = requireText(req.body.noiDung, 'nội dung hợp đồng', 20000);
  const old = (await query('SELECT * FROM HopDong WHERE MaHopDong=@id', { id })).recordset[0];
  if (!old) throw new AppError(404, 'Không tìm thấy hợp đồng.');
  if (old.TrangThai !== 'DRAFT') throw new AppError(400, 'Chỉ được chỉnh sửa hợp đồng ở trạng thái DRAFT (trước khi giao xe).');
  await query('UPDATE HopDong SET NoiDung=@n,NgayCapNhat=SYSDATETIME() WHERE MaHopDong=@id', { n: noiDung, id });
  await writeAudit(req.user.MaNguoiDung, 'HopDong', old.MaDonThue, 'UPDATE', old.NoiDung, noiDung);
  res.json({ message: 'Đã cập nhật hợp đồng.' });
};
