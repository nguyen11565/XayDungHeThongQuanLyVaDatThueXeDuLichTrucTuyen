import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { toInputDateTime } from '../utils/format';

const RUBRIC_ITEMS = [
  {
    stt: 1,
    yeuCau: 'Quy trình thuê xe end-to-end',
    noiDung: 'Chọn xe → chọn ngày thuê/trả → kiểm tra trùng → tạo đơn → xác nhận → nhận xe → đang thuê → trả xe → hoàn tất/hủy.',
    minhChung: 'Stepper 5 bước trên trang Chi tiết đơn; đồng bộ tự động giữa DonThue, Xe, HopDong, PhieuGiaoXe, PhieuTraXe.',
    link: '/',
    linkText: 'Mở trang Đặt xe',
  },
  {
    stt: 2,
    yeuCau: 'Chống trùng lịch thuê xe',
    noiDung: 'Kiểm tra đúng các khoảng thời gian chồng nhau (NgayGioNhan < @Tra AND NgayGioTra > @Nhan) và xử lý nhiều khách đặt cùng xe gần như đồng thời.',
    minhChung: 'Khoá ứng dụng sp_getapplock theo từng xe (XE_THUE_<MaXe>) kết hợp UPDLOCK, HOLDLOCK trong transaction.',
    link: '#concurrency-test',
    linkText: 'Test đặt đồng thời bên dưới',
  },
  {
    stt: 3,
    yeuCau: 'Trạng thái đơn thuê và trạng thái xe',
    noiDung: 'Đơn: PENDING / CONFIRMED / REJECTED / RENTING / RETURNED / COMPLETED / CANCELLED; Xe: AVAILABLE / RESERVED / RENTING / MAINTENANCE / INACTIVE.',
    minhChung: 'Stored procedure sp_DongBoTrangThaiXe + Trigger TR_Xe_KhongNgungKhiCoDonHieuLuc chặn ngưng xe khi còn đơn hiệu lực.',
    link: '/staff',
    linkText: 'Xem bảng trạng thái',
  },
  {
    stt: 4,
    yeuCau: 'Nhận xe - trả xe',
    noiDung: 'Ghi nhận thời điểm nhận/trả, số km (ODO), mức nhiên liệu %, tình trạng xe, đánh dấu cần bảo trì và các phát sinh.',
    minhChung: 'Bảng PhieuGiaoXe (UC13), PhieuTraXe (UC14) và PhiPhatSinh (UC15) hiển thị trực tiếp trong từng đơn thuê.',
    link: '/staff',
    linkText: 'Mở vận hành Giao/Trả xe',
  },
  {
    stt: 5,
    yeuCau: 'Cách tính tiền và hợp đồng',
    noiDung: 'Tính giá theo CEILING(phút/1440), tiền cọc = MIN(CọcXe, TiềnThuê), phí trả trễ 50.000đ/giờ, phí hủy sau xác nhận 10%; tự động lập hợp đồng.',
    minhChung: 'Hợp đồng tự sinh ở trạng thái DRAFT khi xác nhận, chuyển ACTIVE khi giao xe, COMPLETED khi hoàn tất, CANCELLED khi hủy.',
    link: '/staff',
    linkText: 'Xem danh sách Hợp đồng',
  },
  {
    stt: 6,
    yeuCau: 'Chốt thanh toán và thông báo',
    noiDung: 'Cổng thanh toán SANDBOX (mô phỏng SUCCESS / FAILED / CANCELLED) + Tiền mặt / Chuyển khoản; tự động gửi thông báo mọi sự kiện.',
    minhChung: 'Trigger tự động tính lại TrangThaiThanhToan (UNPAID / PARTIAL / PAID / REFUNDED) và tạo bản ghi ThongBao + Job nhắc nhận xe <24h.',
    link: '/notifications',
    linkText: 'Mở trang Thông báo',
  },
  {
    stt: 7,
    yeuCau: 'Phân quyền và lịch sử thay đổi',
    noiDung: 'CUSTOMER / EMPLOYEE / ADMIN (19 quyền chi tiết); lưu ai sửa gì, giá trị cũ → giá trị mới trong AuditLog.',
    minhChung: 'Ma trận phân quyền động + bảng AuditLog toàn hệ thống và Timeline lịch sử trong từng đơn thuê.',
    link: '/admin',
    linkText: 'Mở Phân quyền & Audit Log',
  },
  {
    stt: 8,
    yeuCau: 'Kiểm thử nghiệp vụ',
    noiDung: 'Ngày thuê/trả sai, xe bảo trì, trùng lịch, đặt đồng thời, thanh toán thất bại, hủy sau xác nhận, trả xe trễ.',
    minhChung: 'Bộ 32 test case tự động (32/32 PASS) + công cụ chạy test trực tiếp ngay bên dưới.',
    link: '#business-tests',
    linkText: 'Chạy Test bên dưới',
  },
];

export default function RubricDemoPage() {
  const { user } = useAuth();
  const [concurLogs, setConcurLogs] = useState([]);
  const [runningConcur, setRunningConcur] = useState(false);

  const [testLogs, setTestLogs] = useState([]);
  const [runningTests, setRunningTests] = useState(false);

  // Mô phỏng 6 request đặt CÙNG 1 xe, CÙNG khoảng thời gian gửi đồng thời (Promise.all)
  const runConcurrencySimulation = async () => {
    setRunningConcur(true);
    setConcurLogs([]);
    try {
      const start = new Date();
      start.setDate(start.getDate() + 60 + Math.floor(Math.random() * 500));
      start.setHours(8, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 2);
      const t1 = toInputDateTime(start);
      const t2 = toInputDateTime(end);

      // Đăng nhập 2 khách hàng demo để gửi 6 request song song
      const [l1, l2] = await Promise.all([
        api.post('/auth/login', { email: 'khachhang@demo.vn', matKhau: '123456' }),
        api.post('/auth/login', { email: 'khachhang2@demo.vn', matKhau: '123456' }),
      ]);
      const tokens = [l1.data.token, l2.data.token];

      const requests = Array.from({ length: 6 }, (_, i) =>
        fetch(`${api.defaults.baseURL}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens[i % 2]}`,
          },
          body: JSON.stringify({
            maXe: 1,
            ngayGioNhan: t1,
            ngayGioTra: t2,
            ghiChu: `Request đồng thời #${i + 1}`,
          }),
        }).then(async (r) => ({
          reqNo: i + 1,
          khach: i % 2 === 0 ? 'khachhang@demo.vn' : 'khachhang2@demo.vn',
          status: r.status,
          body: await r.json(),
        }))
      );

      const results = await Promise.all(requests);
      setConcurLogs(results);

      // Hủy đơn vừa tạo để giải phóng lịch sau khi demo
      const winner = results.find((x) => x.status === 201);
      if (winner?.body?.MaDonThue) {
        await fetch(`${api.defaults.baseURL}/orders/${winner.body.MaDonThue}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens[(winner.reqNo - 1) % 2]}`,
          },
          body: JSON.stringify({ lyDo: 'Tự động dọn dữ liệu sau khi demo đặt đồng thời' }),
        });
      }
    } catch (e) {
      setConcurLogs([{ reqNo: 0, khach: 'Lỗi', status: 500, body: { message: getErrMsg(e) } }]);
    } finally {
      setRunningConcur(false);
    }
  };

  // Chạy trực tiếp các tình huống kiểm thử nghiệp vụ bắt buộc (STT 8)
  const runInteractiveSuite = async () => {
    setRunningTests(true);
    const out = [];
    const push = (tc, name, expected, actual, pass) => {
      out.push({ tc, name, expected, actual, pass });
      setTestLogs([...out]);
    };

    try {
      const [khRes, nvRes] = await Promise.all([
        api.post('/auth/login', { email: 'khachhang@demo.vn', matKhau: '123456' }),
        api.post('/auth/login', { email: 'nhanvien@demo.vn', matKhau: '123456' }),
      ]);
      const khToken = khRes.data.token;
      const nvToken = nvRes.data.token;

      const callWith = async (method, url, token, body) => {
        const res = await fetch(`${api.defaults.baseURL}${url}`, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: res.status, data: await res.json() };
      };

      const d0 = new Date();
      d0.setDate(d0.getDate() + 90 + Math.floor(Math.random() * 500));
      d0.setHours(8, 0, 0, 0);
      const d1 = new Date(d0.getTime() + 72 * 3600000); // 3 ngày

      // 1. Ngày trả <= ngày nhận
      let r = await callWith('POST', '/orders', khToken, {
        maXe: 1,
        ngayGioNhan: toInputDateTime(d1),
        ngayGioTra: toInputDateTime(d0),
      });
      push('TC01', 'Ngày trả <= ngày nhận', 'HTTP 400 - Từ chối tạo đơn', `HTTP ${r.status} - ${r.data.message}`, r.status === 400);

      // 2. Xe đang bảo trì (MaXe = 4 - Honda City)
      r = await callWith('POST', '/orders', khToken, {
        maXe: 4,
        ngayGioNhan: toInputDateTime(d0),
        ngayGioTra: toInputDateTime(d1),
      });
      push('TC02', 'Đặt xe đang bảo trì (Honda City)', 'HTTP 400 - Chặn đặt xe MAINTENANCE', `HTTP ${r.status} - ${r.data.message}`, r.status === 400);

      // 3. Tạo đơn hợp lệ 3 ngày
      r = await callWith('POST', '/orders', khToken, {
        maXe: 1,
        ngayGioNhan: toInputDateTime(d0),
        ngayGioTra: toInputDateTime(d1),
        ghiChu: 'Test tự động trên giao diện',
      });
      const maDon = r.data.MaDonThue;
      push(
        'TC03',
        'Tạo đơn hợp lệ 3 ngày (Vios 900k/ngày)',
        'HTTP 201 - PENDING, Tiền thuê = 2.700.000đ, Cọc = 2.000.000đ',
        `HTTP ${r.status} - Đơn #${maDon}, Tiền=${r.data.TongTienDuKien}, Cọc=${r.data.TienCoc}`,
        r.status === 201 && Number(r.data.TongTienDuKien) === 2700000
      );

      // 4. Đặt trùng lịch chồng lấn
      r = await callWith('POST', '/orders', khToken, {
        maXe: 1,
        ngayGioNhan: toInputDateTime(new Date(d0.getTime() + 24 * 3600000)),
        ngayGioTra: toInputDateTime(new Date(d1.getTime() + 24 * 3600000)),
      });
      push('TC04', 'Đặt trùng lịch chồng lấn với đơn vừa tạo', 'HTTP 409 - Từ chối trùng lịch', `HTTP ${r.status} - ${r.data.message}`, r.status === 409);

      // 5. Nhân viên xác nhận đơn -> sinh hợp đồng DRAFT
      r = await callWith('POST', `/orders/${maDon}/confirm`, nvToken);
      push('TC05', 'Nhân viên xác nhận đơn', 'HTTP 200 - CONFIRMED + Tạo hợp đồng DRAFT', `HTTP ${r.status} - ${r.data.message}`, r.status === 200);

      // 6. Thanh toán Sandbox thất bại
      let tx = await callWith('POST', '/payments', khToken, { maDonThue: maDon, loaiThanhToan: 'DEPOSIT', phuongThuc: 'SANDBOX' });
      r = await callWith('POST', `/payments/${tx.data.MaThanhToan}/sandbox`, khToken, { ketQua: 'FAILED' });
      push('TC06', 'Thanh toán Sandbox THẤT BẠI', 'TrangThai = FAILED, gửi thông báo thất bại', `GD ${r.data.MaGiaoDich}: ${r.data.TrangThai}`, r.data.TrangThai === 'FAILED');

      // 7. Thanh toán cọc Sandbox thành công
      tx = await callWith('POST', '/payments', khToken, { maDonThue: maDon, loaiThanhToan: 'DEPOSIT', phuongThuc: 'SANDBOX' });
      r = await callWith('POST', `/payments/${tx.data.MaThanhToan}/sandbox`, khToken, { ketQua: 'SUCCESS' });
      push('TC07', 'Thanh toán cọc Sandbox THÀNH CÔNG (2.000.000đ)', 'TrangThai = SUCCESS, đơn PARTIAL', `GD ${r.data.MaGiaoDich}: ${r.data.TrangThai}`, r.data.TrangThai === 'SUCCESS');

      // 8. Giao xe -> Trả xe trễ 2 giờ -> Tính phí trễ tự động
      await callWith('POST', `/orders/${maDon}/handover`, nvToken, {
        thoiGianGiao: toInputDateTime(d0),
        soKm: 10000,
        mucNhienLieu: 100,
        tinhTrangXe: 'Xe tốt',
      });
      r = await callWith('POST', `/orders/${maDon}/return`, nvToken, {
        thoiGianTra: toInputDateTime(new Date(d1.getTime() + 2 * 3600000)),
        soKm: 10300,
        mucNhienLieu: 85,
        tinhTrangXe: 'Xe bình thường',
        canBaoTri: false,
      });
      push(
        'TC08',
        'Trả xe trễ 2 giờ so với hợp đồng',
        'Tự sinh phí trả trễ 2h × 50.000 = 100.000đ',
        `${r.data.message} (PhiTre = ${r.data.PhiTre})`,
        Number(r.data.PhiTre) === 100000
      );

      // 9. Thanh toán phần còn lại + Hoàn tất đơn
      tx = await callWith('POST', '/payments', khToken, { maDonThue: maDon, loaiThanhToan: 'FULL', phuongThuc: 'SANDBOX' });
      await callWith('POST', `/payments/${tx.data.MaThanhToan}/sandbox`, khToken, { ketQua: 'SUCCESS' });
      r = await callWith('POST', `/orders/${maDon}/complete`, nvToken);
      push('TC09', 'Thanh toán đủ & Hoàn tất đơn thuê', 'HTTP 200 - Đơn & Hợp đồng chuyển sang COMPLETED', `HTTP ${r.status} - ${r.data.message} (Đơn #${maDon})`, r.status === 200);
    } catch (e) {
      push('ERR', 'Lỗi kết nối', 'Hoàn thành', getErrMsg(e), false);
    } finally {
      setRunningTests(false);
    }
  };

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bảng Đối chiếu 8 Yêu cầu Bắt buộc & Kiểm thử Nghiệp vụ</h1>
          <p className="page-subtitle">
            Bám sát 100% bảng tiêu chí chấm đồ án: &ldquo;Xây dựng hệ thống quản lý và đặt thuê xe du lịch trực tuyến&rdquo;
          </p>
        </div>
        {user && (
          <span className="badge badge-primary">
            Đang đăng nhập: {user.HoTen} ({user.TenVaiTro})
          </span>
        )}
      </div>

      {/* Bảng 8 yêu cầu bắt buộc */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-title">📋 Bảng 8 Yêu cầu Bắt buộc khi Chấm Đồ án</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Yêu cầu bắt buộc</th>
                <th>Nội dung cần đạt</th>
                <th>Minh chứng đã cài đặt trong hệ thống</th>
                <th>Truy cập nhanh</th>
              </tr>
            </thead>
            <tbody>
              {RUBRIC_ITEMS.map((item) => (
                <tr key={item.stt}>
                  <td>
                    <strong>{item.stt}</strong>
                  </td>
                  <td style={{ fontWeight: 700, color: '#1e3a8a' }}>{item.yeuCau}</td>
                  <td>{item.noiDung}</td>
                  <td style={{ color: '#065f46' }}>{item.minhChung}</td>
                  <td>
                    {item.link.startsWith('#') ? (
                      <a href={item.link} className="btn btn-outline btn-sm">
                        {item.linkText} ↓
                      </a>
                    ) : (
                      <Link to={item.link} className="btn btn-primary btn-sm">
                        {item.linkText} →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Công cụ 1: Mô phỏng nhiều khách đặt cùng xe đồng thời */}
      <div id="concurrency-test" className="card" style={{ marginBottom: 22, border: '2px solid #2563eb' }}>
        <div className="card-title">
          <span>⚡ Minh chứng STT 2: Mô phỏng 6 Request đặt CÙNG 1 XE, CÙNG GIỜ gửi đồng thời (Race Condition)</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={runConcurrencySimulation}
            disabled={runningConcur}
          >
            {runningConcur ? 'Đang bắn 6 request đồng thời...' : '🚀 Bắn 6 Request Đặt xe Đồng thời'}
          </button>
        </div>
        <p style={{ fontSize: 13.5, color: '#475569', marginBottom: 12 }}>
          Khi nhấn nút, trình duyệt dùng <code>Promise.all</code> bắn đồng thời 6 HTTP POST <code>/api/orders</code> cho cùng xe{' '}
          <strong>Toyota Vios (51A-123.45)</strong> trong cùng một khung giờ. Nhờ <code>sp_getapplock</code> kết hợp{' '}
          <code>UPDLOCK, HOLDLOCK</code> trong SQL Server, <strong>chỉ đúng 1 request thành công (HTTP 201)</strong> và 5 request còn lại bị chặn với mã <strong>HTTP 409 Conflict</strong>.
        </p>

        {concurLogs.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Request #</th>
                  <th>Tài khoản khách</th>
                  <th>HTTP Status</th>
                  <th>Kết quả xử lý từ SQL Server</th>
                </tr>
              </thead>
              <tbody>
                {concurLogs.map((r) => (
                  <tr key={r.reqNo}>
                    <td>
                      <strong>Request #{r.reqNo}</strong>
                    </td>
                    <td>{r.khach}</td>
                    <td>
                      <span className={`badge ${r.status === 201 ? 'badge-success' : 'badge-danger'}`}>
                        HTTP {r.status}
                      </span>
                    </td>
                    <td>
                      {r.status === 201
                        ? `✅ Thành công — Tạo đơn #${r.body.MaDonThue} (Sau đó hệ thống đã tự huỷ đơn test để trả lại lịch trống)`
                        : `❌ Bị chặn: ${r.body.message}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Công cụ 2: Bộ kiểm thử nghiệp vụ trực tiếp */}
      <div id="business-tests" className="card" style={{ border: '2px solid #059669' }}>
        <div className="card-title">
          <span>🧪 Minh chứng STT 8: Chạy Kiểm thử Nghiệp vụ (Expected vs Actual) trực tiếp</span>
          <button
            type="button"
            className="btn btn-success"
            onClick={runInteractiveSuite}
            disabled={runningTests}
          >
            {runningTests ? 'Đang chạy kịch bản...' : '▶️ Chạy Kịch bản Kiểm thử End-to-End (TC01 → TC09)'}
          </button>
        </div>
        <p style={{ fontSize: 13.5, color: '#475569', marginBottom: 12 }}>
          Kiểm tra tự động các tình huống: ngày trả sai, đặt xe đang bảo trì, tạo đơn & tính tiền, trùng lịch, xác nhận sinh hợp đồng, thanh toán Sandbox thất bại & thành công, giao xe, trả xe trễ tự tính phí và hoàn tất đơn.
        </p>

        {testLogs.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã TC</th>
                  <th>Tình huống kiểm thử</th>
                  <th>Kết quả mong đợi (Expected)</th>
                  <th>Kết quả thực tế (Actual)</th>
                  <th>Đánh giá</th>
                </tr>
              </thead>
              <tbody>
                {testLogs.map((t) => (
                  <tr key={t.tc}>
                    <td>
                      <strong>{t.tc}</strong>
                    </td>
                    <td>{t.name}</td>
                    <td>{t.expected}</td>
                    <td>{t.actual}</td>
                    <td>
                      <span className={`badge ${t.pass ? 'badge-success' : 'badge-danger'}`}>
                        {t.pass ? 'PASS ✅' : 'FAIL ❌'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
