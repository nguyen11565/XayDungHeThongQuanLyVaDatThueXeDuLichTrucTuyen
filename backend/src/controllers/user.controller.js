const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { writeAudit } = require('../utils/audit');
const { AppError, requireText, optText, toNumber, EMAIL_RE, PHONE_RE } = require('../utils/http');

const USER_SELECT = `SELECT N.MaNguoiDung,N.HoTen,N.Email,N.SoDienThoai,N.DiaChi,N.TrangThai,N.NgayTao,N.NgayCapNhat,
  N.MaVaiTro,V.TenVaiTro,V.MoTa TenVaiTroHienThi,(SELECT COUNT(*) FROM DonThue D WHERE D.MaKhachHang=N.MaNguoiDung) SoDon
  FROM NguoiDung N JOIN VaiTro V ON V.MaVaiTro=N.MaVaiTro`;

async function countActiveAdmins(excludeId) {
  const r = await query(
    `SELECT COUNT(*) n FROM NguoiDung N JOIN VaiTro V ON V.MaVaiTro=N.MaVaiTro
     WHERE V.TenVaiTro='ADMIN' AND N.TrangThai='ACTIVE' AND N.MaNguoiDung<>@id`, { id: excludeId });
  return r.recordset[0].n;
}

async function isAdmin(id) {
  const r = await query(`SELECT V.TenVaiTro FROM NguoiDung N JOIN VaiTro V ON V.MaVaiTro=N.MaVaiTro WHERE N.MaNguoiDung=@id`, { id });
  if (!r.recordset[0]) throw new AppError(404, 'Không tìm thấy người dùng.');
  return r.recordset[0].TenVaiTro === 'ADMIN';
}

exports.list = async (req, res) => {
  const { q, maVaiTro, trangThai } = req.query;
  const where = []; const p = {};
  if (q) { where.push('(N.HoTen LIKE @q OR N.Email LIKE @q OR N.SoDienThoai LIKE @q)'); p.q = `%${q}%`; }
  if (maVaiTro) { where.push('N.MaVaiTro=@r'); p.r = Number(maVaiTro); }
  if (trangThai) { where.push('N.TrangThai=@t'); p.t = trangThai; }
  const r = await query(`${USER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY N.MaNguoiDung`, p);
  res.json(r.recordset);
};

/** Tạo tài khoản (mặc định nhân viên) */
exports.create = async (req, res) => {
  const hoTen = requireText(req.body.hoTen, 'họ tên', 100);
  const email = requireText(req.body.email, 'email', 150).toLowerCase();
  const sdt = optText(req.body.soDienThoai);
  const matKhau = req.body.matKhau || '';
  const maVaiTro = toNumber(req.body.maVaiTro, 'vai trò', { integer: true });
  if (!EMAIL_RE.test(email)) throw new AppError(400, 'Email không hợp lệ.');
  if (sdt && !PHONE_RE.test(sdt)) throw new AppError(400, 'Số điện thoại không hợp lệ.');
  if (matKhau.length < 6) throw new AppError(400, 'Mật khẩu tối thiểu 6 ký tự.');
  const r = await query(
    `INSERT INTO NguoiDung(MaVaiTro,HoTen,Email,SoDienThoai,MatKhau,DiaChi) OUTPUT INSERTED.MaNguoiDung
     VALUES(@r,@h,@e,@p,@m,@d)`,
    { r: maVaiTro, h: hoTen, e: email, p: sdt, m: await bcrypt.hash(matKhau, 10), d: optText(req.body.diaChi) }
  );
  const id = r.recordset[0].MaNguoiDung;
  await writeAudit(req.user.MaNguoiDung, 'NguoiDung', id, 'CREATE', null, { hoTen, email, maVaiTro });
  res.status(201).json({ message: 'Đã tạo tài khoản.', maNguoiDung: id });
};

exports.update = async (req, res) => {
  const id = Number(req.params.id);
  const old = (await query(`${USER_SELECT} WHERE N.MaNguoiDung=@id`, { id })).recordset[0];
  if (!old) throw new AppError(404, 'Không tìm thấy người dùng.');
  const hoTen = requireText(req.body.hoTen, 'họ tên', 100);
  const sdt = optText(req.body.soDienThoai);
  if (sdt && !PHONE_RE.test(sdt)) throw new AppError(400, 'Số điện thoại không hợp lệ.');
  const diaChi = optText(req.body.diaChi);
  await query('UPDATE NguoiDung SET HoTen=@h,SoDienThoai=@p,DiaChi=@d,NgayCapNhat=SYSDATETIME() WHERE MaNguoiDung=@id', { h: hoTen, p: sdt, d: diaChi, id });
  if (req.body.matKhauMoi) {
    if (req.body.matKhauMoi.length < 6) throw new AppError(400, 'Mật khẩu tối thiểu 6 ký tự.');
    await query('UPDATE NguoiDung SET MatKhau=@m WHERE MaNguoiDung=@id', { m: await bcrypt.hash(req.body.matKhauMoi, 10), id });
  }
  await writeAudit(req.user.MaNguoiDung, 'NguoiDung', id, 'UPDATE',
    { HoTen: old.HoTen, SoDienThoai: old.SoDienThoai, DiaChi: old.DiaChi },
    { HoTen: hoTen, SoDienThoai: sdt, DiaChi: diaChi, DatLaiMatKhau: !!req.body.matKhauMoi });
  res.json({ message: 'Đã cập nhật người dùng.' });
};

/** Khoá / mở khoá - chặn khoá chính mình & quản trị viên cuối cùng */
exports.changeStatus = async (req, res) => {
  const id = Number(req.params.id);
  const trangThai = requireText(req.body.trangThai, 'trạng thái');
  if (!['ACTIVE', 'LOCKED', 'INACTIVE'].includes(trangThai)) throw new AppError(400, 'Trạng thái không hợp lệ.');
  if (id === req.user.MaNguoiDung && trangThai !== 'ACTIVE') throw new AppError(400, 'Không thể tự khoá tài khoản của chính mình.');
  if (trangThai !== 'ACTIVE' && (await isAdmin(id)) && (await countActiveAdmins(id)) === 0) {
    throw new AppError(400, 'Không thể khoá quản trị viên cuối cùng của hệ thống.');
  }
  const old = (await query('SELECT TrangThai FROM NguoiDung WHERE MaNguoiDung=@id', { id })).recordset[0];
  if (!old) throw new AppError(404, 'Không tìm thấy người dùng.');
  await query('UPDATE NguoiDung SET TrangThai=@t,NgayCapNhat=SYSDATETIME() WHERE MaNguoiDung=@id', { t: trangThai, id });
  await writeAudit(req.user.MaNguoiDung, 'NguoiDung', id, trangThai === 'ACTIVE' ? 'UNLOCK' : 'LOCK', old.TrangThai, trangThai);
  res.json({ message: trangThai === 'ACTIVE' ? 'Đã mở khoá tài khoản.' : 'Đã khoá tài khoản.' });
};

/* ---------------- Phân quyền ---------------- */
exports.roles = async (req, res) => {
  const roles = (await query('SELECT * FROM VaiTro ORDER BY MaVaiTro')).recordset;
  const perms = (await query('SELECT * FROM Quyen ORDER BY MaQuyen')).recordset;
  const map = (await query('SELECT * FROM VaiTroQuyen')).recordset;
  res.json({
    vaiTro: roles.map((r) => ({ ...r, quyen: map.filter((m) => m.MaVaiTro === r.MaVaiTro).map((m) => m.MaQuyen) })),
    quyen: perms,
  });
};

exports.setRolePermissions = async (req, res) => {
  const maVaiTro = Number(req.params.id);
  const ids = Array.isArray(req.body.maQuyen) ? req.body.maQuyen.map(Number).filter(Number.isInteger) : null;
  if (!ids) throw new AppError(400, 'Danh sách quyền không hợp lệ.');
  const role = (await query('SELECT * FROM VaiTro WHERE MaVaiTro=@id', { id: maVaiTro })).recordset[0];
  if (!role) throw new AppError(404, 'Không tìm thấy vai trò.');
  const perms = (await query('SELECT MaQuyen,TenQuyen FROM Quyen')).recordset;
  if (role.TenVaiTro === 'ADMIN') {
    const must = perms.filter((p) => ['PERMISSION_MANAGE', 'USER_MANAGE'].includes(p.TenQuyen)).map((p) => p.MaQuyen);
    if (must.some((m) => !ids.includes(m))) throw new AppError(400, 'Không được gỡ quyền PERMISSION_MANAGE / USER_MANAGE khỏi ADMIN (tránh mất quyền quản trị).');
  }
  const oldIds = (await query('SELECT MaQuyen FROM VaiTroQuyen WHERE MaVaiTro=@id', { id: maVaiTro })).recordset.map((x) => x.MaQuyen);
  const name = (list) => perms.filter((p) => list.includes(p.MaQuyen)).map((p) => p.TenQuyen);
  await query(
    `DELETE FROM VaiTroQuyen WHERE MaVaiTro=@id;
     INSERT INTO VaiTroQuyen(MaVaiTro,MaQuyen) SELECT @id, MaQuyen FROM Quyen WHERE MaQuyen IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@ids, ','));`,
    { id: maVaiTro, ids: ids.join(',') || '0' }
  );
  await writeAudit(req.user.MaNguoiDung, 'VaiTro', role.TenVaiTro, 'SET_PERMISSIONS',
    { bo: name(oldIds.filter((x) => !ids.includes(x))) }, { them: name(ids.filter((x) => !oldIds.includes(x))) });
  res.json({ message: `Đã cập nhật quyền cho vai trò ${role.TenVaiTro}.` });
};

exports.changeRole = async (req, res) => {
  const id = Number(req.params.id);
  const maVaiTro = toNumber(req.body.maVaiTro, 'vai trò', { integer: true });
  const old = (await query(`${USER_SELECT} WHERE N.MaNguoiDung=@id`, { id })).recordset[0];
  if (!old) throw new AppError(404, 'Không tìm thấy người dùng.');
  const role = (await query('SELECT * FROM VaiTro WHERE MaVaiTro=@r', { r: maVaiTro })).recordset[0];
  if (!role) throw new AppError(400, 'Vai trò không tồn tại.');
  if (old.TenVaiTro === 'ADMIN' && role.TenVaiTro !== 'ADMIN' && (await countActiveAdmins(id)) === 0) {
    throw new AppError(400, 'Không thể hạ quyền quản trị viên cuối cùng.');
  }
  await query('UPDATE NguoiDung SET MaVaiTro=@r,NgayCapNhat=SYSDATETIME() WHERE MaNguoiDung=@id', { r: maVaiTro, id });
  await writeAudit(req.user.MaNguoiDung, 'NguoiDung', id, 'CHANGE_ROLE', old.TenVaiTro, role.TenVaiTro);
  res.json({ message: `Đã đổi vai trò thành ${role.MoTa}.` });
};
