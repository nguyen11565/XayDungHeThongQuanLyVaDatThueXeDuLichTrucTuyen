const { query } = require('../config/db');

/** Ghi lịch sử thay đổi (ai sửa gì) */
async function writeAudit(userId, loaiDoiTuong, maDoiTuong, hanhDong, giaTriCu, giaTriMoi, tx) {
  const s = (v) => (v === undefined || v === null ? null : typeof v === 'string' ? v : JSON.stringify(v));
  await query(
    `INSERT INTO AuditLog(MaNguoiDung,LoaiDoiTuong,MaDoiTuong,HanhDong,GiaTriCu,GiaTriMoi)
     VALUES(@u,@l,@m,@h,@c,@n)`,
    { u: userId ?? null, l: loaiDoiTuong, m: String(maDoiTuong), h: hanhDong, c: s(giaTriCu), n: s(giaTriMoi) },
    tx
  );
}

module.exports = { writeAudit };
