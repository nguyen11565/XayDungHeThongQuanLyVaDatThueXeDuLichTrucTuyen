const fs = require('fs');
const path = require('path');
const { query, exec } = require('../config/db');
const { hasPerm } = require('../middlewares/auth');
const { writeAudit } = require('../utils/audit');
const { quote } = require('../utils/pricing');
const { AppError, toDate, toNumber, requireText, optText } = require('../utils/http');

const CAR_SELECT = `
  SELECT X.MaXe,X.MaLoaiXe,X.BienSo,X.TenXe,X.HangXe,X.NamSanXuat,X.GiaThueNgay,X.TienCoc,X.TrangThai,X.MoTa,
         X.NgayTao,X.NgayCapNhat,L.TenLoai,L.SoCho,
         (SELECT TOP 1 DuongDan FROM HinhAnhXe H WHERE H.MaXe=X.MaXe ORDER BY ThuTu,MaHinhAnh) AS AnhDaiDien
  FROM Xe X JOIN LoaiXe L ON L.MaLoaiXe=X.MaLoaiXe`;

exports.list = async (req, res) => {
  const { q, maLoaiXe, soCho, giaMin, giaMax, tuNgay, denNgay, trangThai, hangXe, sapXep } = req.query;
  const manage = hasPerm(req.user, 'CAR_MANAGE', 'ORDER_PROCESS');
  const where = [];
  const p = {};
  if (!manage) where.push(`X.TrangThai<>'INACTIVE'`);
  if (q) { where.push('(X.TenXe LIKE @q OR X.HangXe LIKE @q OR X.BienSo LIKE @q)'); p.q = `%${q}%`; }
  if (maLoaiXe) { where.push('X.MaLoaiXe=@lx'); p.lx = Number(maLoaiXe); }
  if (soCho) { where.push('L.SoCho>=@sc'); p.sc = Number(soCho); }
  if (giaMin) { where.push('X.GiaThueNgay>=@gmin'); p.gmin = Number(giaMin); }
  if (giaMax) { where.push('X.GiaThueNgay<=@gmax'); p.gmax = Number(giaMax); }
  if (hangXe) { where.push('X.HangXe=@hx'); p.hx = hangXe; }
  if (trangThai) { where.push('X.TrangThai=@tt'); p.tt = trangThai; }
  if (tuNgay && denNgay) {
    const n = toDate(tuNgay, 'ngày nhận'); const t = toDate(denNgay, 'ngày trả');
    if (t <= n) throw new AppError(400, 'Ngày trả phải sau ngày nhận.');
    where.push(`X.TrangThai NOT IN ('MAINTENANCE','INACTIVE')`);
    where.push(`NOT EXISTS(SELECT 1 FROM DonThue D WHERE D.MaXe=X.MaXe AND D.TrangThai IN ('PENDING','CONFIRMED','RENTING')
                AND D.NgayGioNhan<@tra AND D.NgayGioTra>@nhan)`);
    p.nhan = n; p.tra = t;
  }
  const order = { gia_tang: 'X.GiaThueNgay ASC', gia_giam: 'X.GiaThueNgay DESC', moi: 'X.NamSanXuat DESC' }[sapXep] || 'X.MaXe ASC';
  const r = await query(`${CAR_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`, p);
  res.json(r.recordset);
};

exports.detail = async (req, res) => {
  const id = Number(req.params.id);
  const r = await query(`${CAR_SELECT} WHERE X.MaXe=@id`, { id });
  const car = r.recordset[0];
  if (!car) throw new AppError(404, 'Không tìm thấy xe.');
  if (car.TrangThai === 'INACTIVE' && !hasPerm(req.user, 'CAR_MANAGE', 'ORDER_PROCESS')) {
    throw new AppError(404, 'Xe đã ngưng hoạt động.');
  }
  const imgs = await query('SELECT MaHinhAnh,DuongDan,MoTa,ThuTu FROM HinhAnhXe WHERE MaXe=@id ORDER BY ThuTu,MaHinhAnh', { id });
  // Lịch bận sắp tới (không lộ thông tin khách)
  const busy = await query(
    `SELECT NgayGioNhan,NgayGioTra,TrangThai FROM DonThue
     WHERE MaXe=@id AND TrangThai IN ('PENDING','CONFIRMED','RENTING') AND NgayGioTra>=SYSDATETIME()
     ORDER BY NgayGioNhan`, { id });
  res.json({ ...car, hinhAnh: imgs.recordset, lichBan: busy.recordset });
};

/** UC06 - Kiểm tra trùng lịch + báo giá */
exports.availability = async (req, res) => {
  const id = Number(req.params.id);
  const nhan = toDate(req.query.tuNgay, 'ngày nhận');
  const tra = toDate(req.query.denNgay, 'ngày trả');
  const r = await query('SELECT MaXe,TrangThai,GiaThueNgay,TienCoc FROM Xe WHERE MaXe=@id', { id });
  const car = r.recordset[0];
  if (!car) throw new AppError(404, 'Không tìm thấy xe.');
  if (tra <= nhan) {
    return res.json({ khaDung: false, lyDo: 'Thời gian trả phải lớn hơn thời gian nhận.' });
  }
  if (nhan.getTime() < Date.now() - 5 * 60000) {
    return res.json({ khaDung: false, lyDo: 'Thời gian nhận xe không được ở quá khứ.' });
  }
  if (['MAINTENANCE', 'INACTIVE'].includes(car.TrangThai)) {
    return res.json({ khaDung: false, lyDo: 'Xe đang bảo trì hoặc ngưng hoạt động.', trangThaiXe: car.TrangThai });
  }
  const conflicts = (await exec('sp_KiemTraTrungLich', { MaXe: id, NgayGioNhan: nhan, NgayGioTra: tra })).recordset;
  const bg = quote(car.GiaThueNgay, car.TienCoc, nhan, tra);
  if (conflicts.length) {
    return res.json({ khaDung: false, lyDo: 'Xe đã có lịch thuê trùng với khoảng thời gian đã chọn.', trungLich: conflicts.map(({ NgayGioNhan, NgayGioTra, TrangThai }) => ({ NgayGioNhan, NgayGioTra, TrangThai })), baoGia: bg });
  }
  res.json({ khaDung: true, baoGia: bg });
};

function parseCar(body) {
  const nam = toNumber(body.namSanXuat, 'năm sản xuất', { integer: true, required: false });
  if (nam !== null && (nam < 1990 || nam > 2100)) throw new AppError(400, 'Năm sản xuất không hợp lệ.');
  const gia = toNumber(body.giaThueNgay, 'giá thuê/ngày', { min: 1 });
  const coc = toNumber(body.tienCoc ?? 0, 'tiền cọc', { min: 0 });
  return {
    MaLoaiXe: toNumber(body.maLoaiXe, 'loại xe', { integer: true }),
    BienSo: requireText(body.bienSo, 'biển số', 20).toUpperCase(),
    TenXe: requireText(body.tenXe, 'tên xe', 120),
    HangXe: optText(body.hangXe),
    NamSanXuat: nam,
    GiaThueNgay: gia,
    TienCoc: coc,
    MoTa: optText(body.moTa),
  };
}

exports.create = async (req, res) => {
  const c = parseCar(req.body);
  const r = await query(
    `INSERT INTO Xe(MaLoaiXe,BienSo,TenXe,HangXe,NamSanXuat,GiaThueNgay,TienCoc,MoTa)
     OUTPUT INSERTED.MaXe VALUES(@MaLoaiXe,@BienSo,@TenXe,@HangXe,@NamSanXuat,@GiaThueNgay,@TienCoc,@MoTa)`,
    { ...c, GiaThueNgay: { type: require('mssql').Decimal(18, 2), value: c.GiaThueNgay }, TienCoc: { type: require('mssql').Decimal(18, 2), value: c.TienCoc } }
  );
  const id = r.recordset[0].MaXe;
  await writeAudit(req.user.MaNguoiDung, 'Xe', id, 'CREATE', null, c);
  res.status(201).json({ message: 'Đã thêm xe.', maXe: id });
};

exports.update = async (req, res) => {
  const id = Number(req.params.id);
  const old = (await query('SELECT * FROM Xe WHERE MaXe=@id', { id })).recordset[0];
  if (!old) throw new AppError(404, 'Không tìm thấy xe.');
  const c = parseCar(req.body);
  const sql = require('mssql');
  await query(
    `UPDATE Xe SET MaLoaiXe=@MaLoaiXe,BienSo=@BienSo,TenXe=@TenXe,HangXe=@HangXe,NamSanXuat=@NamSanXuat,
       GiaThueNgay=@GiaThueNgay,TienCoc=@TienCoc,MoTa=@MoTa,NgayCapNhat=SYSDATETIME() WHERE MaXe=@id`,
    { ...c, id, GiaThueNgay: { type: sql.Decimal(18, 2), value: c.GiaThueNgay }, TienCoc: { type: sql.Decimal(18, 2), value: c.TienCoc } }
  );
  const diffOld = {}; const diffNew = {};
  for (const k of Object.keys(c)) {
    const a = old[k] === null ? null : String(old[k]); const b = c[k] === null ? null : String(c[k]);
    if (a !== b) { diffOld[k] = old[k]; diffNew[k] = c[k]; }
  }
  await writeAudit(req.user.MaNguoiDung, 'Xe', id, 'UPDATE', diffOld, diffNew);
  res.json({ message: 'Đã cập nhật xe.' });
};

exports.changeStatus = async (req, res) => {
  const trangThai = requireText(req.body.trangThai, 'trạng thái');
  await exec('sp_CapNhatTrangThaiXe', { MaXe: Number(req.params.id), TrangThaiMoi: trangThai, MaNguoiDung: req.user.MaNguoiDung });
  res.json({ message: 'Đã cập nhật trạng thái xe.' });
};

exports.remove = async (req, res) => {
  const id = Number(req.params.id);
  const used = await query('SELECT COUNT(*) n FROM DonThue WHERE MaXe=@id', { id });
  if (used.recordset[0].n > 0) throw new AppError(400, 'Xe đã phát sinh đơn thuê, không thể xoá. Hãy chuyển sang trạng thái Tạm ngưng (INACTIVE).');
  const old = (await query('SELECT * FROM Xe WHERE MaXe=@id', { id })).recordset[0];
  if (!old) throw new AppError(404, 'Không tìm thấy xe.');
  await query('DELETE FROM Xe WHERE MaXe=@id', { id });
  await writeAudit(req.user.MaNguoiDung, 'Xe', id, 'DELETE', old, null);
  res.json({ message: 'Đã xoá xe.' });
};

exports.addImages = async (req, res) => {
  const id = Number(req.params.id);
  const exists = await query('SELECT 1 FROM Xe WHERE MaXe=@id', { id });
  if (!exists.recordset.length) throw new AppError(404, 'Không tìm thấy xe.');
  const files = req.files || [];
  const urls = [];
  if (req.body.duongDan) urls.push(String(req.body.duongDan));
  for (const f of files) urls.push(`/uploads/cars/${f.filename}`);
  if (!urls.length) throw new AppError(400, 'Chưa chọn ảnh.');
  const max = (await query('SELECT ISNULL(MAX(ThuTu),0) m FROM HinhAnhXe WHERE MaXe=@id', { id })).recordset[0].m;
  let i = max;
  for (const u of urls) {
    i += 1;
    await query('INSERT INTO HinhAnhXe(MaXe,DuongDan,ThuTu) VALUES(@id,@u,@t)', { id, u, t: i });
  }
  await writeAudit(req.user.MaNguoiDung, 'Xe', id, 'ADD_IMAGE', null, urls);
  res.status(201).json({ message: `Đã thêm ${urls.length} ảnh.` });
};

exports.removeImage = async (req, res) => {
  const imageId = Number(req.params.imageId);
  const img = (await query('SELECT * FROM HinhAnhXe WHERE MaHinhAnh=@i', { i: imageId })).recordset[0];
  if (!img) throw new AppError(404, 'Không tìm thấy ảnh.');
  await query('DELETE FROM HinhAnhXe WHERE MaHinhAnh=@i', { i: imageId });
  if (img.DuongDan.startsWith('/uploads/cars/') && !/(vios|fortuner|transit|city|accent|xpander|carnival|solati)\.jpg$/.test(img.DuongDan)) {
    fs.unlink(path.join(__dirname, '..', '..', img.DuongDan), () => {});
  }
  await writeAudit(req.user.MaNguoiDung, 'Xe', img.MaXe, 'REMOVE_IMAGE', img.DuongDan, null);
  res.json({ message: 'Đã xoá ảnh.' });
};

/* ---------- Loại xe ---------- */
exports.listTypes = async (req, res) => {
  const r = await query(`SELECT L.*,(SELECT COUNT(*) FROM Xe X WHERE X.MaLoaiXe=L.MaLoaiXe) SoXe FROM LoaiXe L ORDER BY L.SoCho`);
  res.json(r.recordset);
};

exports.saveType = async (req, res) => {
  const id = req.params.id ? Number(req.params.id) : null;
  const t = {
    TenLoai: requireText(req.body.tenLoai, 'tên loại', 100),
    SoCho: toNumber(req.body.soCho, 'số chỗ', { min: 1, integer: true }),
    MoTa: optText(req.body.moTa),
    TrangThai: req.body.trangThai === undefined ? true : !!req.body.trangThai,
  };
  if (id) {
    const old = (await query('SELECT * FROM LoaiXe WHERE MaLoaiXe=@id', { id })).recordset[0];
    if (!old) throw new AppError(404, 'Không tìm thấy loại xe.');
    await query('UPDATE LoaiXe SET TenLoai=@TenLoai,SoCho=@SoCho,MoTa=@MoTa,TrangThai=@TrangThai WHERE MaLoaiXe=@id', { ...t, id });
    await writeAudit(req.user.MaNguoiDung, 'LoaiXe', id, 'UPDATE', old, t);
    return res.json({ message: 'Đã cập nhật loại xe.' });
  }
  const r = await query('INSERT INTO LoaiXe(TenLoai,SoCho,MoTa,TrangThai) OUTPUT INSERTED.MaLoaiXe VALUES(@TenLoai,@SoCho,@MoTa,@TrangThai)', t);
  await writeAudit(req.user.MaNguoiDung, 'LoaiXe', r.recordset[0].MaLoaiXe, 'CREATE', null, t);
  res.status(201).json({ message: 'Đã thêm loại xe.' });
};

exports.removeType = async (req, res) => {
  const id = Number(req.params.id);
  const n = (await query('SELECT COUNT(*) n FROM Xe WHERE MaLoaiXe=@id', { id })).recordset[0].n;
  if (n > 0) throw new AppError(400, 'Loại xe đang có xe, không thể xoá.');
  await query('DELETE FROM LoaiXe WHERE MaLoaiXe=@id', { id });
  await writeAudit(req.user.MaNguoiDung, 'LoaiXe', id, 'DELETE', null, null);
  res.json({ message: 'Đã xoá loại xe.' });
};
