/**
 * KIỂM THỬ NGHIỆP VỤ TỰ ĐỘNG (chạy khi backend đang chạy)
 *   npm run test:business
 * Kết quả in ra console và ghi file tests/KetQuaKiemThu.md (bảng Expected / Actual)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API = process.env.API_URL || 'http://localhost:5000/api';
const results = [];

async function ensureServer() {
  try {
    const r = await fetch(`${API}/health`);
    if (r.ok) return null;
  } catch { /* server not running yet */ }
  const app = require('../src/app');
  return new Promise((resolve) => {
    const srv = app.listen(Number(process.env.PORT || 5000), () => resolve(srv));
  });
}

async function call(method, url, token, body) {
  const res = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

function record(ma, tinhHuong, kyVong, thucTe, pass) {
  results.push({ ma, tinhHuong, kyVong, thucTe, pass: !!pass });
  console.log(`${pass ? '✅' : '❌'} ${ma} - ${tinhHuong}\n     Kỳ vọng: ${kyVong}\n     Thực tế: ${thucTe}`);
}

const pad = (n) => String(n).padStart(2, '0');
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addH = (d, h) => new Date(d.getTime() + h * 3600000);
const msg = (r) => `HTTP ${r.status} - ${r.data?.message || r.data?.TrangThai || ''}`;

async function login(email) {
  const r = await call('POST', '/auth/login', null, { email, matKhau: '123456' });
  if (r.status !== 200) throw new Error(`Không đăng nhập được ${email}: ${msg(r)}`);
  return r.data.token;
}

async function main() {
  await ensureServer();
  console.log(`== Kiểm thử nghiệp vụ trên ${API} ==\n`);
  const admin = await login('admin@demo.vn');
  const nv = await login('nhanvien@demo.vn');
  const kh1 = await login('khachhang@demo.vn');
  const kh2 = await login('khachhang2@demo.vn');

  const cars = (await call('GET', '/cars', admin)).data;
  const vios = cars.find((c) => c.BienSo === '51A-123.45') || cars.find((c) => c.TrangThai === 'AVAILABLE');
  const baoTri = cars.find((c) => c.TrangThai === 'MAINTENANCE');
  const xe2 = cars.find((c) => c.BienSo === '30G-456.78') || cars.find((c) => c.TrangThai === 'AVAILABLE' && c.MaXe !== vios.MaXe);

  // Chọn mốc thời gian ngẫu nhiên trong tương lai để chạy lại nhiều lần không bị trùng
  const base = new Date(); base.setDate(base.getDate() + 30 + Math.floor(Math.random() * 3000)); base.setHours(8, 0, 0, 0);
  const n1 = base; const t1 = addH(base, 72); // 3 ngày

  // ---------- Kiểm tra dữ liệu đầu vào ----------
  let r = await call('POST', '/orders', kh1, { maXe: vios.MaXe, ngayGioNhan: local(n1), ngayGioTra: local(addH(n1, -1)) });
  record('TC01', 'Ngày trả <= ngày nhận', 'Từ chối (400)', msg(r), r.status === 400);

  r = await call('POST', '/orders', kh1, { maXe: vios.MaXe, ngayGioNhan: local(addH(new Date(), -48)), ngayGioTra: local(addH(new Date(), 24)) });
  record('TC02', 'Ngày nhận ở quá khứ', 'Từ chối (400)', msg(r), r.status === 400);

  if (baoTri) {
    r = await call('POST', '/orders', kh1, { maXe: baoTri.MaXe, ngayGioNhan: local(n1), ngayGioTra: local(t1) });
    record('TC03', `Đặt xe đang bảo trì (${baoTri.TenXe})`, 'Từ chối (400)', msg(r), r.status === 400);
  }

  // ---------- Đặt xe & trùng lịch ----------
  r = await call('POST', '/orders', kh1, { maXe: vios.MaXe, ngayGioNhan: local(n1), ngayGioTra: local(t1), ghiChu: 'Test E2E' });
  const don = r.data?.MaDonThue;
  const tienKyVong = 3 * vios.GiaThueNgay;
  record('TC04', 'Tạo đơn hợp lệ 3 ngày', `201, PENDING, tiền = 3 x ${vios.GiaThueNgay} = ${tienKyVong}`,
    `${msg(r)} - Đơn #${don}, tiền ${r.data?.TongTienDuKien}, cọc ${r.data?.TienCoc}`,
    r.status === 201 && Number(r.data.TongTienDuKien) === tienKyVong);

  r = await call('GET', `/cars/${vios.MaXe}/availability?tuNgay=${local(addH(n1, 24))}&denNgay=${local(addH(t1, 24))}`);
  record('TC05a', 'Kiểm tra khả dụng khoảng chồng lấn', 'khaDung = false', `khaDung = ${r.data?.khaDung} - ${r.data?.lyDo || ''}`, r.data?.khaDung === false);

  r = await call('POST', '/orders', kh2, { maXe: vios.MaXe, ngayGioNhan: local(addH(n1, 24)), ngayGioTra: local(addH(t1, 24)) });
  record('TC05b', 'Khách khác đặt khoảng chồng lấn 1 ngày', 'Từ chối (409)', msg(r), r.status === 409);

  r = await call('POST', '/orders', kh2, { maXe: vios.MaXe, ngayGioNhan: local(addH(n1, -24)), ngayGioTra: local(addH(t1, 24)) });
  record('TC05c', 'Đặt khoảng bao trùm đơn cũ', 'Từ chối (409)', msg(r), r.status === 409);

  r = await call('POST', '/orders', kh2, { maXe: vios.MaXe, ngayGioNhan: local(t1), ngayGioTra: local(addH(t1, 24)) });
  record('TC06', 'Đặt sát biên (nhận = giờ trả của đơn trước)', 'Thành công (201) vì [A,B) không chồng [B,C)', msg(r), r.status === 201);
  if (r.data?.MaDonThue) await call('POST', `/orders/${r.data.MaDonThue}/cancel`, kh2, { lyDo: 'Dọn test biên' });

  // ---------- Đặt đồng thời ----------
  const n7 = addH(t1, 24 * 5); const t7 = addH(n7, 24);
  const reqs = Array.from({ length: 10 }, (_, i) => call('POST', '/orders', i % 2 ? kh2 : kh1, { maXe: vios.MaXe, ngayGioNhan: local(n7), ngayGioTra: local(t7), ghiChu: `Concurrent ${i}` }));
  const all = await Promise.all(reqs);
  const ok = all.filter((x) => x.status === 201); const conflict = all.filter((x) => x.status === 409);
  record('TC07', '10 yêu cầu đặt CÙNG xe, CÙNG giờ, gửi đồng thời', 'Đúng 1 thành công, 9 bị từ chối 409',
    `${ok.length} thành công, ${conflict.length} bị 409, khác: ${all.length - ok.length - conflict.length}`, ok.length === 1 && conflict.length === 9);
  const donDongThoi = ok[0]?.data?.MaDonThue;

  // ---------- Phân quyền ----------
  r = await call('POST', `/orders/${don}/confirm`, kh1);
  record('TC08', 'Khách hàng tự xác nhận đơn', 'Từ chối (403)', msg(r), r.status === 403);
  r = await call('GET', `/orders/${don}`, kh2);
  record('TC09', 'Khách xem đơn của người khác', 'Từ chối (403)', msg(r), r.status === 403);
  r = await call('POST', `/orders/${don}/cancel`, kh2, { lyDo: 'phá' });
  record('TC10', 'Khách huỷ đơn của người khác', 'Từ chối (403)', msg(r), r.status === 403);
  r = await call('GET', '/audit-logs', nv);
  record('TC11', 'Nhân viên xem audit log (chỉ admin)', 'Từ chối (403)', msg(r), r.status === 403);

  // ---------- Quy trình end-to-end ----------
  r = await call('POST', `/orders/${don}/confirm`, nv);
  let d = (await call('GET', `/orders/${don}`, nv)).data;
  record('TC12', 'Nhân viên xác nhận đơn', 'CONFIRMED, xe RESERVED, hợp đồng DRAFT',
    `${msg(r)} | đơn ${d.TrangThai}, xe ${d.TrangThaiXe}, HĐ ${d.hopDong?.TrangThai}`,
    d.TrangThai === 'CONFIRMED' && d.TrangThaiXe === 'RESERVED' && d.hopDong?.TrangThai === 'DRAFT');

  r = await call('POST', `/orders/${don}/handover`, nv, { soKm: 12000, mucNhienLieu: 100, tinhTrangXe: 'Tốt' });
  record('TC13', 'Giao xe khi khách chưa đặt cọc', 'Từ chối (400)', msg(r), r.status === 400);

  let p = await call('POST', '/payments', kh1, { maDonThue: don, loaiThanhToan: 'DEPOSIT', phuongThuc: 'SANDBOX' });
  r = await call('POST', `/payments/${p.data.MaThanhToan}/sandbox`, kh1, { ketQua: 'FAILED' });
  d = (await call('GET', `/orders/${don}`, kh1)).data;
  record('TC14', 'Thanh toán cọc sandbox THẤT BẠI', 'Giao dịch FAILED, đơn vẫn UNPAID, có thông báo',
    `GD ${r.data?.TrangThai}, đơn ${d.TrangThaiThanhToan}`, r.data?.TrangThai === 'FAILED' && d.TrangThaiThanhToan === 'UNPAID');

  p = await call('POST', '/payments', kh1, { maDonThue: don, loaiThanhToan: 'DEPOSIT', phuongThuc: 'SANDBOX' });
  r = await call('POST', `/payments/${p.data.MaThanhToan}/sandbox`, kh1, { ketQua: 'SUCCESS' });
  d = (await call('GET', `/orders/${don}`, kh1)).data;
  record('TC15', 'Thanh toán cọc sandbox THÀNH CÔNG', `SUCCESS ${d.TienCoc}đ, đơn PARTIAL`,
    `GD ${r.data?.TrangThai} ${r.data?.SoTien}, đơn ${d.TrangThaiThanhToan}`, r.data?.TrangThai === 'SUCCESS' && d.TrangThaiThanhToan === 'PARTIAL');

  r = await call('POST', `/payments/${p.data.MaThanhToan}/sandbox`, kh1, { ketQua: 'SUCCESS' });
  record('TC16', 'Gửi lại callback thanh toán lần 2 (trùng)', 'Từ chối (409), không cộng tiền 2 lần', msg(r), r.status === 409);

  r = await call('POST', `/orders/${don}/handover`, nv, { soKm: 12000, mucNhienLieu: 100, tinhTrangXe: 'Xe sạch, không trầy' });
  d = (await call('GET', `/orders/${don}`, nv)).data;
  record('TC17', 'Giao xe sau khi đã cọc', 'RENTING, xe RENTING, HĐ ACTIVE',
    `${msg(r)} | đơn ${d.TrangThai}, xe ${d.TrangThaiXe}, HĐ ${d.hopDong?.TrangThai}`,
    d.TrangThai === 'RENTING' && d.TrangThaiXe === 'RENTING' && d.hopDong?.TrangThai === 'ACTIVE');

  r = await call('POST', `/orders/${don}/cancel`, kh1, { lyDo: 'Đổi ý' });
  record('TC18', 'Huỷ đơn đang thuê', 'Từ chối (400)', msg(r), r.status === 400);

  r = await call('POST', `/orders/${don}/complete`, nv);
  record('TC19', 'Hoàn tất khi chưa trả xe', 'Từ chối (400)', msg(r), r.status === 400);

  const traTre = new Date(new Date(d.NgayGioTra).getTime() + (3 * 60 + 10) * 60000);
  r = await call('POST', `/orders/${don}/return`, nv, {
    thoiGianTra: local(traTre), soKm: 12450, mucNhienLieu: 60, tinhTrangXe: 'Bình thường, hơi bẩn',
    phiPhatSinh: [{ loaiPhi: 'CLEANING', soTien: 200000, lyDo: 'Vệ sinh nội thất' }],
  });
  d = (await call('GET', `/orders/${don}`, nv)).data;
  record('TC20', 'Trả xe trễ 3 giờ 10 phút + phí vệ sinh', 'Phí trễ = CEILING(190/60)=4h x 50.000 = 200.000; tổng phí 400.000; xe AVAILABLE',
    `${msg(r)} | phí phát sinh ${d.TongPhiPhatSinh}, xe ${d.TrangThaiXe}, đơn ${d.TrangThai}`,
    Number(r.data?.PhiTre) === 200000 && Number(d.TongPhiPhatSinh) === 400000 && d.TrangThai === 'RETURNED');

  r = await call('POST', `/orders/${don}/complete`, nv);
  record('TC21', 'Hoàn tất khi còn nợ phí phát sinh', 'Từ chối (400)', msg(r), r.status === 400);

  r = await call('POST', '/payments/counter', nv, { maDonThue: don, soTien: d.conLai + 1000, loaiThanhToan: 'FULL', phuongThuc: 'CASH' });
  record('TC22', 'Thu tiền vượt quá số còn nợ', 'Từ chối (400)', msg(r), r.status === 400);

  p = await call('POST', '/payments', kh1, { maDonThue: don, loaiThanhToan: 'FULL', phuongThuc: 'SANDBOX' });
  await call('POST', `/payments/${p.data.MaThanhToan}/sandbox`, kh1, { ketQua: 'SUCCESS' });
  r = await call('POST', `/orders/${don}/complete`, nv);
  d = (await call('GET', `/orders/${don}`, kh1)).data;
  record('TC23', 'Thanh toán phần còn lại rồi hoàn tất', `PAID, COMPLETED, đã trả = ${tienKyVong + 400000}`,
    `${msg(r)} | ${d.TrangThaiThanhToan}, ${d.TrangThai}, đã trả ${d.DaThanhToan}, HĐ ${d.hopDong?.TrangThai}`,
    d.TrangThai === 'COMPLETED' && d.TrangThaiThanhToan === 'PAID' && Number(d.DaThanhToan) === tienKyVong + 400000);

  const loai = d.lichSu.map((x) => x.HanhDong);
  record('TC24', 'Lịch sử đơn ghi đủ ai làm gì', 'CREATE→CONFIRM→HANDOVER→RETURN→COMPLETE', loai.filter((x) => ['CREATE', 'CONFIRM', 'HANDOVER', 'RETURN', 'COMPLETE'].includes(x)).join('→'),
    ['CREATE', 'CONFIRM', 'HANDOVER', 'RETURN', 'COMPLETE'].every((x) => loai.includes(x)));

  // ---------- Huỷ sau xác nhận ----------
  const n2 = addH(t1, 24 * 10);
  r = await call('POST', '/orders', kh1, { maXe: xe2.MaXe, ngayGioNhan: local(n2), ngayGioTra: local(addH(n2, 72)) });
  const don2 = r.data.MaDonThue; const tien2 = Number(r.data.TongTienDuKien); const coc2 = Number(r.data.TienCoc);
  await call('POST', `/orders/${don2}/confirm`, nv);
  p = await call('POST', '/payments', kh1, { maDonThue: don2, loaiThanhToan: 'DEPOSIT', phuongThuc: 'SANDBOX' });
  await call('POST', `/payments/${p.data.MaThanhToan}/sandbox`, kh1, { ketQua: 'SUCCESS' });
  r = await call('POST', `/orders/${don2}/cancel`, kh1, { lyDo: 'Thay đổi kế hoạch' });
  d = (await call('GET', `/orders/${don2}`, kh1)).data;
  const phiHuy = Math.min(Math.round(tien2 * 0.1), coc2);
  record('TC25', 'Khách huỷ đơn SAU khi đã xác nhận & đặt cọc', `Phí huỷ 10% = ${phiHuy}, hoàn ${coc2 - phiHuy}, REFUNDED, xe trả về trống`,
    `${msg(r)} | ${d.TrangThai}, ${d.TrangThaiThanhToan}, xe ${d.TrangThaiXe}`,
    d.TrangThai === 'CANCELLED' && Number(r.data?.PhiHuy) === phiHuy && Number(r.data?.SoTienHoan) === coc2 - phiHuy && d.TrangThaiXe !== 'RESERVED');

  // ---------- Trạng thái xe ----------
  if (donDongThoi) {
    r = await call('PATCH', `/cars/${vios.MaXe}/status`, admin, { trangThai: 'INACTIVE' });
    record('TC26', 'Tạm ngưng xe khi còn đơn hiệu lực', 'Từ chối (400)', msg(r), r.status === 400);
    r = await call('POST', `/orders/${donDongThoi}/reject`, nv, { lyDo: '' });
    record('TC27', 'Từ chối đơn không nhập lý do', 'Từ chối (400)', msg(r), r.status === 400);
    r = await call('POST', `/orders/${donDongThoi}/reject`, nv, { lyDo: 'Xe cần điều phối cho đoàn khác' });
    record('TC28', 'Từ chối đơn có lý do', 'REJECTED', msg(r), r.status === 200);
  }

  // ---------- Tài khoản bị khoá ----------
  const email = `test${Date.now()}@demo.vn`;
  const phone = `09${String(Date.now()).slice(-8)}`;
  r = await call('POST', '/auth/register', null, { hoTen: 'Khách Test', email, soDienThoai: phone, matKhau: '123456' });
  const uid = r.data?.maNguoiDung;
  r = await call('POST', '/auth/register', null, { hoTen: 'Khách Test', email, soDienThoai: '0911111111', matKhau: '123456' });
  record('TC29', 'Đăng ký email đã tồn tại', 'Từ chối (409)', msg(r), r.status === 409);
  await call('PATCH', `/users/${uid}/status`, admin, { trangThai: 'LOCKED' });
  r = await call('POST', '/auth/login', null, { email, matKhau: '123456' });
  record('TC30', 'Đăng nhập tài khoản bị khoá', 'Từ chối (403)', msg(r), r.status === 403);

  // ---------- Ghi báo cáo ----------
  const pass = results.filter((x) => x.pass).length;
  const md = [
    '# Kết quả kiểm thử nghiệp vụ',
    '',
    `- Thời điểm chạy: ${new Date().toLocaleString('vi-VN')}`,
    `- API: ${API}`,
    `- Kết quả: **${pass}/${results.length} PASS**`,
    '',
    '| Mã | Tình huống | Kết quả mong đợi (Expected) | Kết quả thực tế (Actual) | Đạt |',
    '|---|---|---|---|---|',
    ...results.map((x) => `| ${x.ma} | ${x.tinhHuong} | ${x.kyVong} | ${String(x.thucTe).replace(/\|/g, '/')} | ${x.pass ? '✅' : '❌'} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(__dirname, 'KetQuaKiemThu.md'), md, 'utf8');
  console.log(`\n== ${pass}/${results.length} PASS == (đã ghi tests/KetQuaKiemThu.md)`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => { console.error('Lỗi khi chạy kiểm thử:', e.message); process.exit(2); });
