const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { signToken, loadUser } = require('../middlewares/auth');
const { writeAudit } = require('../utils/audit');
const { AppError, requireText, optText, EMAIL_RE, PHONE_RE } = require('../utils/http');

exports.register = async (req, res) => {
  const hoTen = requireText(req.body.hoTen, 'họ tên', 100);
  const email = requireText(req.body.email, 'email', 150).toLowerCase();
  const soDienThoai = requireText(req.body.soDienThoai, 'số điện thoại', 20);
  const matKhau = req.body.matKhau || '';
  const diaChi = optText(req.body.diaChi);
  if (!EMAIL_RE.test(email)) throw new AppError(400, 'Email không đúng định dạng.');
  if (!PHONE_RE.test(soDienThoai)) throw new AppError(400, 'Số điện thoại phải gồm 10-11 chữ số, bắt đầu bằng 0.');
  if (matKhau.length < 6) throw new AppError(400, 'Mật khẩu tối thiểu 6 ký tự.');

  const dup = await query('SELECT Email,SoDienThoai FROM NguoiDung WHERE Email=@e OR SoDienThoai=@p', { e: email, p: soDienThoai });
  if (dup.recordset.length) {
    const d = dup.recordset[0];
    throw new AppError(409, d.Email === email ? 'Email đã được sử dụng.' : 'Số điện thoại đã được sử dụng.');
  }
  const hash = await bcrypt.hash(matKhau, 10);
  const r = await query(
    `INSERT INTO NguoiDung(MaVaiTro,HoTen,Email,SoDienThoai,MatKhau,DiaChi)
     OUTPUT INSERTED.MaNguoiDung
     VALUES((SELECT MaVaiTro FROM VaiTro WHERE TenVaiTro='CUSTOMER'),@h,@e,@p,@m,@d)`,
    { h: hoTen, e: email, p: soDienThoai, m: hash, d: diaChi }
  );
  const id = r.recordset[0].MaNguoiDung;
  await writeAudit(id, 'NguoiDung', id, 'REGISTER', null, { email, hoTen });
  res.status(201).json({ message: 'Đăng ký thành công, vui lòng đăng nhập.', maNguoiDung: id });
};

exports.login = async (req, res) => {
  const email = requireText(req.body.email, 'email').toLowerCase();
  const matKhau = req.body.matKhau || '';
  const r = await query('SELECT MaNguoiDung,MatKhau,TrangThai FROM NguoiDung WHERE Email=@e', { e: email });
  const row = r.recordset[0];
  if (!row || !(await bcrypt.compare(matKhau, row.MatKhau))) {
    throw new AppError(401, 'Email hoặc mật khẩu không đúng.');
  }
  if (row.TrangThai !== 'ACTIVE') throw new AppError(403, 'Tài khoản đã bị khoá hoặc ngưng hoạt động. Liên hệ quản trị viên.');
  const user = await loadUser(row.MaNguoiDung);
  await writeAudit(user.MaNguoiDung, 'NguoiDung', user.MaNguoiDung, 'LOGIN', null, null);
  res.json({ token: signToken(user), user });
};

exports.me = async (req, res) => res.json({ user: req.user });

exports.updateProfile = async (req, res) => {
  const u = req.user;
  const hoTen = requireText(req.body.hoTen, 'họ tên', 100);
  const soDienThoai = requireText(req.body.soDienThoai, 'số điện thoại', 20);
  const diaChi = optText(req.body.diaChi);
  if (!PHONE_RE.test(soDienThoai)) throw new AppError(400, 'Số điện thoại không hợp lệ.');
  const dup = await query('SELECT 1 FROM NguoiDung WHERE SoDienThoai=@p AND MaNguoiDung<>@id', { p: soDienThoai, id: u.MaNguoiDung });
  if (dup.recordset.length) throw new AppError(409, 'Số điện thoại đã được tài khoản khác sử dụng.');
  await query(
    'UPDATE NguoiDung SET HoTen=@h,SoDienThoai=@p,DiaChi=@d,NgayCapNhat=SYSDATETIME() WHERE MaNguoiDung=@id',
    { h: hoTen, p: soDienThoai, d: diaChi, id: u.MaNguoiDung }
  );
  await writeAudit(u.MaNguoiDung, 'NguoiDung', u.MaNguoiDung, 'UPDATE_PROFILE',
    { HoTen: u.HoTen, SoDienThoai: u.SoDienThoai, DiaChi: u.DiaChi }, { HoTen: hoTen, SoDienThoai: soDienThoai, DiaChi: diaChi });
  res.json({ message: 'Cập nhật hồ sơ thành công.', user: await loadUser(u.MaNguoiDung) });
};

exports.changePassword = async (req, res) => {
  const { matKhauCu, matKhauMoi } = req.body;
  if (!matKhauMoi || matKhauMoi.length < 6) throw new AppError(400, 'Mật khẩu mới tối thiểu 6 ký tự.');
  const r = await query('SELECT MatKhau FROM NguoiDung WHERE MaNguoiDung=@id', { id: req.user.MaNguoiDung });
  if (!(await bcrypt.compare(matKhauCu || '', r.recordset[0].MatKhau))) throw new AppError(400, 'Mật khẩu hiện tại không đúng.');
  await query('UPDATE NguoiDung SET MatKhau=@m,NgayCapNhat=SYSDATETIME() WHERE MaNguoiDung=@id', {
    m: await bcrypt.hash(matKhauMoi, 10), id: req.user.MaNguoiDung,
  });
  await writeAudit(req.user.MaNguoiDung, 'NguoiDung', req.user.MaNguoiDung, 'CHANGE_PASSWORD', null, null);
  res.json({ message: 'Đổi mật khẩu thành công.' });
};
