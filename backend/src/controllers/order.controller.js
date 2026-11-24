const { query, exec, withTransaction } = require('../config/db');
const { hasPerm } = require('../middlewares/auth');
const { AppError, toDate, toNumber, requireText, optText } = require('../utils/http');

const ORDER_SELECT = `
  SELECT D.*, X.TenXe,X.BienSo,X.HangXe,X.TrangThai AS TrangThaiXe,L.TenLoai,L.SoCho,
         K.HoTen AS TenKhachHang,K.Email AS EmailKhachHang,K.SoDienThoai AS SdtKhachHang,
         NV.HoTen AS TenNhanVienXacNhan, NH.HoTen AS TenNguoiHuy,
         dbo.fn_TongDaThanhToan(D.MaDonThue) AS DaThanhToan,
         (SELECT TOP 1 DuongDan FROM HinhAnhXe H WHERE H.MaXe=X.MaXe ORDER BY ThuTu,MaHinhAnh) AS AnhXe
  FROM DonThue D
  JOIN Xe X ON X.MaXe=D.MaXe JOIN LoaiXe L ON L.MaLoaiXe=X.MaLoaiXe
  JOIN NguoiDung K ON K.MaNguoiDung=D.MaKhachHang
  LEFT JOIN NguoiDung NV ON NV.MaNguoiDung=D.MaNhanVienXacNhan
  LEFT JOIN NguoiDung NH ON NH.MaNguoiDung=D.MaNguoiHuy`;

async function getOrderOr404(id) {
  const r = await query(`${ORDER_SELECT} WHERE D.MaDonThue=@id`, { id });
  if (!r.recordset[0]) throw new AppError(404, 'Không tìm thấy đơn thuê.');
  return r.recordset[0];
}

function ensureCanView(user, order) {
  if (hasPerm(user, 'ORDER_PROCESS')) return;
  if (hasPerm(user, 'ORDER_VIEW_OWN') && order.MaKhachHang === user.MaNguoiDung) return;
  throw new AppError(403, 'Bạn không có quyền xem đơn thuê này.');
}

/** UC05 - Đặt thuê xe (chống trùng lịch nằm trong sp_TaoDonThue) */
exports.create = async (req, res) => {
  const maXe = toNumber(req.body.maXe, 'xe', { integer: true });
  const nhan = toDate(req.body.ngayGioNhan, 'ngày giờ nhận');
  const tra = toDate(req.body.ngayGioTra, 'ngày giờ trả');
  const r = await exec('sp_TaoDonThue', {
    MaKhachHang: req.user.MaNguoiDung, MaXe: maXe, NgayGioNhan: nhan, NgayGioTra: tra, GhiChu: optText(req.body.ghiChu),
  });
  res.status(201).json({ message: 'Đặt xe thành công! Đơn đang chờ xác nhận.', ...r.recordset[0] });
};

exports.list = async (req, res) => {
  const { trangThai, q, tuNgay, denNgay, trangThaiThanhToan, maXe } = req.query;
  const where = []; const p = {};
  if (!hasPerm(req.user, 'ORDER_PROCESS')) { where.push('D.MaKhachHang=@me'); p.me = req.user.MaNguoiDung; }
  if (trangThai) { where.push('D.TrangThai IN (SELECT value FROM STRING_SPLIT(@tt, \',\'))'); p.tt = trangThai; }
  if (trangThaiThanhToan) { where.push('D.TrangThaiThanhToan=@tttt'); p.tttt = trangThaiThanhToan; }
  if (maXe) { where.push('D.MaXe=@mx'); p.mx = Number(maXe); }
  if (q) {
    where.push('(CAST(D.MaDonThue AS VARCHAR(20))=@qx OR K.HoTen LIKE @q OR K.Email LIKE @q OR K.SoDienThoai LIKE @q OR X.BienSo LIKE @q OR X.TenXe LIKE @q)');
    p.q = `%${q}%`; p.qx = String(q).replace('#', '');
  }
  if (tuNgay) { where.push('D.NgayGioNhan>=@tu'); p.tu = toDate(tuNgay, 'từ ngày'); }
  if (denNgay) { where.push('D.NgayGioNhan<@den'); p.den = toDate(denNgay, 'đến ngày'); }
  const r = await query(`SELECT TOP 500 * FROM (${ORDER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}) T ORDER BY T.MaDonThue DESC`, p);
  res.json(r.recordset);
};

exports.detail = async (req, res) => {
  const id = Number(req.params.id);
  const order = await getOrderOr404(id);
  ensureCanView(req.user, order);
  const [giao, tra, phi, tt, hd, ls] = await Promise.all([
    query(`SELECT P.*,N.HoTen TenNhanVien FROM PhieuGiaoXe P JOIN NguoiDung N ON N.MaNguoiDung=P.MaNhanVien WHERE MaDonThue=@id`, { id }),
    query(`SELECT P.*,N.HoTen TenNhanVien FROM PhieuTraXe P JOIN NguoiDung N ON N.MaNguoiDung=P.MaNhanVien WHERE MaDonThue=@id`, { id }),
    query(`SELECT P.*,N.HoTen TenNhanVien FROM PhiPhatSinh P LEFT JOIN NguoiDung N ON N.MaNguoiDung=P.MaNhanVienTao WHERE MaDonThue=@id ORDER BY MaPhi`, { id }),
    query(`SELECT T.*,N.HoTen TenNhanVien FROM ThanhToan T LEFT JOIN NguoiDung N ON N.MaNguoiDung=T.MaNhanVienXacNhan WHERE MaDonThue=@id ORDER BY MaThanhToan`, { id }),
    query(`SELECT MaHopDong,SoHopDong,NgayLap,TrangThai FROM HopDong WHERE MaDonThue=@id`, { id }),
    query(`SELECT A.MaLog,A.HanhDong,A.GiaTriCu,A.GiaTriMoi,A.ThoiGian,A.LoaiDoiTuong,N.HoTen,V.MoTa VaiTro
           FROM AuditLog A LEFT JOIN NguoiDung N ON N.MaNguoiDung=A.MaNguoiDung LEFT JOIN VaiTro V ON V.MaVaiTro=N.MaVaiTro
           WHERE (A.LoaiDoiTuong IN ('DonThue','HopDong','PhiPhatSinh') AND A.MaDoiTuong=@sid)
              OR (A.LoaiDoiTuong='ThanhToan' AND (A.MaDoiTuong=@sid OR A.MaDoiTuong IN (SELECT CAST(MaThanhToan AS VARCHAR(100)) FROM ThanhToan WHERE MaDonThue=@id)))
           ORDER BY A.ThoiGian,A.MaLog`, { id, sid: String(id) }),
  ]);
  res.json({
    ...order,
    phieuGiao: giao.recordset[0] || null,
    phieuTra: tra.recordset[0] || null,
    phiPhatSinh: phi.recordset,
    thanhToan: tt.recordset,
    hopDong: hd.recordset[0] || null,
    lichSu: ls.recordset,
    conLai: Number(order.TongTienPhaiTra) - Number(order.DaThanhToan),
  });
};

/** Nhân viên kiểm tra lại lịch trước khi xác nhận */
exports.checkConflict = async (req, res) => {
  const id = Number(req.params.id);
  const o = await getOrderOr404(id);
  const c = await exec('sp_KiemTraTrungLich', { MaXe: o.MaXe, NgayGioNhan: o.NgayGioNhan, NgayGioTra: o.NgayGioTra, MaDonThueBoQua: id });
  const xungDot = c.recordset.filter((x) => x.TrangThai !== 'PENDING');
  res.json({
    trangThaiXe: o.TrangThaiXe,
    xeKhaDung: !['MAINTENANCE', 'INACTIVE'].includes(o.TrangThaiXe),
    xungDot,
    donChoKhac: c.recordset.filter((x) => x.TrangThai === 'PENDING'),
    coTheXacNhan: o.TrangThai === 'PENDING' && xungDot.length === 0 && !['MAINTENANCE', 'INACTIVE'].includes(o.TrangThaiXe),
  });
};

exports.confirm = async (req, res) => {
  await exec('sp_XacNhanDon', { MaDonThue: Number(req.params.id), MaNhanVien: req.user.MaNguoiDung });
  res.json({ message: 'Đã xác nhận đơn và tạo hợp đồng nháp.' });
};

exports.reject = async (req, res) => {
  const lyDo = requireText(req.body.lyDo, 'lý do từ chối', 500);
  await exec('sp_TuChoiDon', { MaDonThue: Number(req.params.id), MaNhanVien: req.user.MaNguoiDung, LyDo: lyDo });
  res.json({ message: 'Đã từ chối đơn.' });
};

exports.cancel = async (req, res) => {
  const isStaff = hasPerm(req.user, 'ORDER_CONFIRM');
  if (!isStaff && !hasPerm(req.user, 'ORDER_CANCEL_OWN')) throw new AppError(403, 'Bạn không có quyền huỷ đơn.');
  const r = await exec('sp_HuyDon', {
    MaDonThue: Number(req.params.id), MaNguoiHuy: req.user.MaNguoiDung,
    LyDo: optText(req.body.lyDo), ChiChuDon: !isStaff,
  });
  const { PhiHuy, SoTienHoan } = r.recordset[0] || {};
  res.json({ message: `Đã huỷ đơn.${PhiHuy > 0 ? ` Phí huỷ: ${Number(PhiHuy).toLocaleString('vi-VN')}đ.` : ''}${SoTienHoan > 0 ? ` Hoàn lại: ${Number(SoTienHoan).toLocaleString('vi-VN')}đ.` : ''}`, PhiHuy, SoTienHoan });
};

/** UC13 - Giao xe */
exports.handover = async (req, res) => {
  const b = req.body;
  const nl = toNumber(b.mucNhienLieu, 'mức nhiên liệu', { min: 0, integer: true, required: false });
  if (nl !== null && nl > 100) throw new AppError(400, 'Mức nhiên liệu từ 0-100%.');
  await exec('sp_GiaoXe', {
    MaDonThue: Number(req.params.id), MaNhanVien: req.user.MaNguoiDung,
    ThoiGianGiao: b.thoiGianGiao ? toDate(b.thoiGianGiao, 'thời gian giao') : new Date(),
    SoKm: toNumber(b.soKm, 'số km', { min: 0 }),
    MucNhienLieu: nl, TinhTrangXe: requireText(b.tinhTrangXe, 'tình trạng xe'), GhiChu: optText(b.ghiChu),
  });
  res.json({ message: 'Đã ghi nhận giao xe. Đơn chuyển sang Đang thuê.' });
};

/** UC14 + UC15 - Nhận trả xe + phí phát sinh (cùng 1 transaction) */
exports.returnCar = async (req, res) => {
  const b = req.body;
  const id = Number(req.params.id);
  const nl = toNumber(b.mucNhienLieu, 'mức nhiên liệu', { min: 0, integer: true, required: false });
  if (nl !== null && nl > 100) throw new AppError(400, 'Mức nhiên liệu từ 0-100%.');
  const fees = Array.isArray(b.phiPhatSinh) ? b.phiPhatSinh.filter((f) => f && Number(f.soTien) > 0) : [];
  const fee = fees.map((f) => ({
    LoaiPhi: requireText(f.loaiPhi, 'loại phí', 30),
    SoTien: toNumber(f.soTien, 'số tiền phí', { min: 1 }),
    LyDo: requireText(f.lyDo, 'lý do phí'),
  }));
  const result = await withTransaction(async (tx) => {
    const r = await exec('sp_NhanTraXe', {
      MaDonThue: id, MaNhanVien: req.user.MaNguoiDung,
      ThoiGianTra: b.thoiGianTra ? toDate(b.thoiGianTra, 'thời gian trả') : new Date(),
      SoKm: toNumber(b.soKm, 'số km', { min: 0 }),
      MucNhienLieu: nl, TinhTrangXe: requireText(b.tinhTrangXe, 'tình trạng xe'),
      CanBaoTri: !!b.canBaoTri, GhiChu: optText(b.ghiChu),
    }, tx);
    for (const f of fee) {
      await exec('sp_ThemPhiPhatSinh', { MaDonThue: id, MaNhanVien: req.user.MaNguoiDung, ...f }, tx);
    }
    return r.recordset[0];
  });
  res.json({
    message: `Đã nhận trả xe.${result?.PhiTre > 0 ? ` Trễ ${result.SoGioTre} giờ, phí trễ ${Number(result.PhiTre).toLocaleString('vi-VN')}đ.` : ''}`,
    ...result,
  });
};

exports.addFee = async (req, res) => {
  await exec('sp_ThemPhiPhatSinh', {
    MaDonThue: Number(req.params.id), MaNhanVien: req.user.MaNguoiDung,
    LoaiPhi: requireText(req.body.loaiPhi, 'loại phí', 30),
    SoTien: toNumber(req.body.soTien, 'số tiền', { min: 1 }),
    LyDo: requireText(req.body.lyDo, 'lý do'),
  });
  res.json({ message: 'Đã thêm phí phát sinh.' });
};

exports.complete = async (req, res) => {
  await exec('sp_HoanTatDon', { MaDonThue: Number(req.params.id), MaNhanVien: req.user.MaNguoiDung });
  res.json({ message: 'Đơn đã hoàn tất.' });
};

exports.getOrderOr404 = getOrderOr404;
exports.ensureCanView = ensureCanView;
