const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { AppError } = require('../utils/http');

const SECRET = () => process.env.JWT_SECRET || 'dev_secret_change_me';

function signToken(user) {
  return jwt.sign({ id: user.MaNguoiDung, role: user.TenVaiTro }, SECRET(), {
    expiresIn: process.env.JWT_EXPIRES || '1d',
  });
}

/** Nạp người dùng + quyền từ DB ở mỗi request => đổi quyền có hiệu lực ngay */
async function loadUser(id) {
  const r = await query(
    `SELECT N.MaNguoiDung,N.HoTen,N.Email,N.SoDienThoai,N.DiaChi,N.TrangThai,N.MaVaiTro,V.TenVaiTro,V.MoTa AS TenVaiTroHienThi
     FROM NguoiDung N JOIN VaiTro V ON V.MaVaiTro=N.MaVaiTro WHERE N.MaNguoiDung=@id`,
    { id }
  );
  const user = r.recordset[0];
  if (!user) return null;
  const p = await query(
    `SELECT Q.TenQuyen FROM VaiTroQuyen VQ JOIN Quyen Q ON Q.MaQuyen=VQ.MaQuyen
     WHERE VQ.MaVaiTro=@r AND Q.TrangThai=1`,
    { r: user.MaVaiTro }
  );
  user.permissions = p.recordset.map((x) => x.TenQuyen);
  return user;
}

async function resolve(req, required) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    if (required) throw new AppError(401, 'Bạn cần đăng nhập.');
    return;
  }
  let payload;
  try {
    payload = jwt.verify(token, SECRET());
  } catch {
    throw new AppError(401, 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.');
  }
  const user = await loadUser(payload.id);
  if (!user) throw new AppError(401, 'Tài khoản không tồn tại.');
  if (user.TrangThai !== 'ACTIVE') throw new AppError(403, 'Tài khoản đã bị khoá hoặc ngưng hoạt động.');
  req.user = user;
}

const authenticate = (req, res, next) => resolve(req, true).then(() => next()).catch(next);
const optionalAuth = (req, res, next) => resolve(req, false).then(() => next()).catch(next);

const hasPerm = (user, ...perms) => !!user && perms.some((p) => user.permissions.includes(p));

/** Yêu cầu có ít nhất 1 trong các quyền */
const requirePerm = (...perms) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'Bạn cần đăng nhập.'));
  if (!hasPerm(req.user, ...perms)) {
    return next(new AppError(403, `Bạn không có quyền thực hiện thao tác này (cần: ${perms.join(' / ')}).`));
  }
  next();
};

module.exports = { signToken, loadUser, authenticate, optionalAuth, requirePerm, hasPerm };
