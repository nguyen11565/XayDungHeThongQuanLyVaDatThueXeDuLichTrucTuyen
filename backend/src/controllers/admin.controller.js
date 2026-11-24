const { query } = require('../config/db');
const { writeAudit } = require('../utils/audit');
const { AppError, toDate, requireText, toNumber, optText } = require('../utils/http');

/* ---------------- Audit log ---------------- */
exports.auditList = async (req, res) => {
  const { maNguoiDung, hanhDong, loaiDoiTuong, maDoiTuong, tuNgay, denNgay, q } = req.query;
  const page = Math.max(1, Number(req.query.page || 1));
  const size = Math.min(200, Math.max(10, Number(req.query.size || 50)));
  const where = []; const p = {};
  if (maNguoiDung) { where.push('A.MaNguoiDung=@u'); p.u = Number(maNguoiDung); }
  if (hanhDong) { where.push('A.HanhDong=@h'); p.h = hanhDong; }
  if (loaiDoiTuong) { where.push('A.LoaiDoiTuong=@l'); p.l = loaiDoiTuong; }
  if (maDoiTuong) { where.push('A.MaDoiTuong=@m'); p.m = String(maDoiTuong); }
  if (q) { where.push('(N.HoTen LIKE @q OR N.Email LIKE @q OR A.GiaTriMoi LIKE @q)'); p.q = `%${q}%`; }
  if (tuNgay) { where.push('A.ThoiGian>=@tu'); p.tu = toDate(tuNgay, 'từ ngày'); }
  if (denNgay) { const d = toDate(denNgay, 'đến ngày'); d.setDate(d.getDate() + 1); where.push('A.ThoiGian<@den'); p.den = d; }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const from = `FROM AuditLog A LEFT JOIN NguoiDung N ON N.MaNguoiDung=A.MaNguoiDung LEFT JOIN VaiTro V ON V.MaVaiTro=N.MaVaiTro ${w}`;
  const total = (await query(`SELECT COUNT(*) n ${from}`, p)).recordset[0].n;
  const rows = (await query(
    `SELECT A.*,N.HoTen,N.Email,V.TenVaiTro ${from} ORDER BY A.ThoiGian DESC,A.MaLog DESC OFFSET @off ROWS FETCH NEXT @size ROWS ONLY`,
    { ...p, off: (page - 1) * size, size })).recordset;
  const meta = (await query('SELECT DISTINCT HanhDong FROM AuditLog ORDER BY HanhDong')).recordset.map((x) => x.HanhDong);
  const types = (await query('SELECT DISTINCT LoaiDoiTuong FROM AuditLog ORDER BY LoaiDoiTuong')).recordset.map((x) => x.LoaiDoiTuong);
  res.json({ total, page, size, rows, hanhDong: meta, loaiDoiTuong: types });
};

/* ---------------- Báo cáo (UC22) ---------------- */
exports.summary = async (req, res) => {
  const tu = req.query.tuNgay ? toDate(req.query.tuNgay, 'từ ngày') : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const den = req.query.denNgay ? toDate(req.query.denNgay, 'đến ngày') : new Date();
  const denEx = new Date(den); denEx.setHours(0, 0, 0, 0); denEx.setDate(denEx.getDate() + 1);
  if (denEx <= tu) throw new AppError(400, 'Khoảng thời gian không hợp lệ (đến ngày phải >= từ ngày).');
  const p = { tu, den: denEx };
  const [doanhThu, theoNgay, donTT, hieuSuat, xeTT, topKH, theoLoai] = await Promise.all([
    query(`SELECT ISNULL(SUM(CASE WHEN LoaiThanhToan='REFUND' THEN -SoTien ELSE SoTien END),0) DoanhThuThuan,
                  ISNULL(SUM(CASE WHEN LoaiThanhToan='REFUND' THEN SoTien ELSE 0 END),0) HoanTien,
                  COUNT(*) SoGiaoDich
           FROM ThanhToan WHERE TrangThai='SUCCESS' AND ISNULL(ThoiGianXuLy,ThoiGianTao)>=@tu AND ISNULL(ThoiGianXuLy,ThoiGianTao)<@den`, p),
    query(`SELECT CAST(ISNULL(ThoiGianXuLy,ThoiGianTao) AS DATE) Ngay,
                  SUM(CASE WHEN LoaiThanhToan='REFUND' THEN -SoTien ELSE SoTien END) DoanhThu, COUNT(*) SoGiaoDich
           FROM ThanhToan WHERE TrangThai='SUCCESS' AND ISNULL(ThoiGianXuLy,ThoiGianTao)>=@tu AND ISNULL(ThoiGianXuLy,ThoiGianTao)<@den
           GROUP BY CAST(ISNULL(ThoiGianXuLy,ThoiGianTao) AS DATE) ORDER BY Ngay`, p),
    query(`SELECT TrangThai,COUNT(*) SoLuong FROM DonThue WHERE NgayTao>=@tu AND NgayTao<@den GROUP BY TrangThai`, p),
    query(`SELECT X.MaXe,X.TenXe,X.BienSo,X.TrangThai,COUNT(D.MaDonThue) SoDon,
                  SUM(CASE WHEN D.TrangThai='COMPLETED' THEN 1 ELSE 0 END) SoDonHoanTat,
                  ISNULL(SUM(CASE WHEN D.TrangThai='COMPLETED' THEN D.TongTienPhaiTra END),0) DoanhThu,
                  ISNULL(SUM(CASE WHEN D.TrangThai IN ('COMPLETED','RETURNED','RENTING') THEN D.SoNgayThue END),0) SoNgayKhaiThac
           FROM Xe X LEFT JOIN DonThue D ON D.MaXe=X.MaXe AND D.NgayGioNhan>=@tu AND D.NgayGioNhan<@den
           GROUP BY X.MaXe,X.TenXe,X.BienSo,X.TrangThai ORDER BY DoanhThu DESC`, p),
    query(`SELECT TrangThai,COUNT(*) SoLuong FROM Xe GROUP BY TrangThai`),
    query(`SELECT TOP 5 K.HoTen,K.Email,COUNT(*) SoDon,SUM(D.TongTienPhaiTra) TongChi FROM DonThue D JOIN NguoiDung K ON K.MaNguoiDung=D.MaKhachHang
           WHERE D.TrangThai='COMPLETED' AND D.NgayTao>=@tu AND D.NgayTao<@den GROUP BY K.HoTen,K.Email ORDER BY TongChi DESC`, p),
    query(`SELECT L.TenLoai,COUNT(D.MaDonThue) SoDon FROM LoaiXe L LEFT JOIN Xe X ON X.MaLoaiXe=L.MaLoaiXe
           LEFT JOIN DonThue D ON D.MaXe=X.MaXe AND D.NgayTao>=@tu AND D.NgayTao<@den GROUP BY L.TenLoai`, p),
  ]);
  res.json({
    tuNgay: tu, denNgay: den,
    tongQuan: doanhThu.recordset[0],
    doanhThuTheoNgay: theoNgay.recordset,
    donTheoTrangThai: donTT.recordset,
    hieuSuatXe: hieuSuat.recordset,
    xeTheoTrangThai: xeTT.recordset,
    topKhachHang: topKH.recordset,
    donTheoLoaiXe: theoLoai.recordset,
  });
};

/** Bảng điều khiển nhân viên */
exports.staffDashboard = async (req, res) => {
  const r = await query(`
    SELECT
     (SELECT COUNT(*) FROM DonThue WHERE TrangThai='PENDING') ChoXacNhan,
     (SELECT COUNT(*) FROM DonThue WHERE TrangThai='CONFIRMED') DaXacNhan,
     (SELECT COUNT(*) FROM DonThue WHERE TrangThai='CONFIRMED' AND CAST(NgayGioNhan AS DATE)=CAST(SYSDATETIME() AS DATE)) GiaoHomNay,
     (SELECT COUNT(*) FROM DonThue WHERE TrangThai='RENTING') DangThue,
     (SELECT COUNT(*) FROM DonThue WHERE TrangThai='RENTING' AND NgayGioTra<SYSDATETIME()) QuaHanTra,
     (SELECT COUNT(*) FROM DonThue WHERE TrangThai='RETURNED') ChoThanhToan,
     (SELECT COUNT(*) FROM ThanhToan WHERE TrangThai='PENDING' AND PhuongThuc='BANK_TRANSFER') CKChoDuyet,
     (SELECT COUNT(*) FROM Xe WHERE TrangThai='AVAILABLE') XeTrong,
     (SELECT COUNT(*) FROM Xe WHERE TrangThai='MAINTENANCE') XeBaoTri`);
  res.json(r.recordset[0]);
};

/* ---------------- Quy tắc phí ---------------- */
exports.feeRules = async (req, res) => {
  res.json((await query('SELECT * FROM QuyTacPhi ORDER BY LoaiPhi,MaQuyTac')).recordset);
};

exports.saveFeeRule = async (req, res) => {
  const id = req.params.id ? Number(req.params.id) : null;
  const r = {
    LoaiPhi: requireText(req.body.loaiPhi, 'loại phí', 30),
    TenQuyTac: requireText(req.body.tenQuyTac, 'tên quy tắc', 150),
    KieuTinh: requireText(req.body.kieuTinh, 'kiểu tính', 20),
    GiaTri: toNumber(req.body.giaTri, 'giá trị', { min: 0 }),
    TrangThai: req.body.trangThai === undefined ? true : !!req.body.trangThai,
    GhiChu: optText(req.body.ghiChu),
  };
  if (id) {
    const old = (await query('SELECT * FROM QuyTacPhi WHERE MaQuyTac=@id', { id })).recordset[0];
    if (!old) throw new AppError(404, 'Không tìm thấy quy tắc phí.');
    await query('UPDATE QuyTacPhi SET LoaiPhi=@LoaiPhi,TenQuyTac=@TenQuyTac,KieuTinh=@KieuTinh,GiaTri=@GiaTri,TrangThai=@TrangThai,GhiChu=@GhiChu WHERE MaQuyTac=@id', { ...r, id });
    await writeAudit(req.user.MaNguoiDung, 'QuyTacPhi', id, 'UPDATE', old, r);
    return res.json({ message: 'Đã cập nhật quy tắc phí.' });
  }
  const ins = await query('INSERT INTO QuyTacPhi(LoaiPhi,TenQuyTac,KieuTinh,GiaTri,TrangThai,GhiChu) OUTPUT INSERTED.MaQuyTac VALUES(@LoaiPhi,@TenQuyTac,@KieuTinh,@GiaTri,@TrangThai,@GhiChu)', r);
  await writeAudit(req.user.MaNguoiDung, 'QuyTacPhi', ins.recordset[0].MaQuyTac, 'CREATE', null, r);
  res.status(201).json({ message: 'Đã thêm quy tắc phí.' });
};
