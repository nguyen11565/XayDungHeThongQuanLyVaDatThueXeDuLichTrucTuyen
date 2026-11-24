import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import api, { imgUrl, getErrMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { CAR_STATUS, ORDER_STATUS, defaultBookingDates, formatDateTime, formatVND } from '../utils/format';

export default function CarDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, hasPerm, fetchUnread } = useAuth();

  const defDates = defaultBookingDates();
  const [tuNgay, setTuNgay] = useState(searchParams.get('tuNgay') || defDates.tuNgay);
  const [denNgay, setDenNgay] = useState(searchParams.get('denNgay') || defDates.denNgay);
  const [ghiChu, setGhiChu] = useState('');

  const [car, setCar] = useState(null);
  const [avail, setAvail] = useState(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const loadCar = useCallback(async () => {
    try {
      const r = await api.get(`/cars/${id}`);
      setCar(r.data);
    } catch (e) {
      setErr(getErrMsg(e));
    }
  }, [id]);

  const checkAvail = useCallback(
    async (t1, t2) => {
      if (!t1 || !t2) return;
      setChecking(true);
      setErr('');
      try {
        const r = await api.get(`/cars/${id}/availability`, { params: { tuNgay: t1, denNgay: t2 } });
        setAvail(r.data);
      } catch (e) {
        setAvail({ khaDung: false, lyDo: getErrMsg(e) });
      } finally {
        setChecking(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadCar();
    checkAvail(tuNgay, denNgay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: `/cars/${id}` } });
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      const r = await api.post('/orders', {
        maXe: Number(id),
        ngayGioNhan: tuNgay,
        ngayGioTra: denNgay,
        ghiChu,
      });
      await fetchUnread();
      navigate(`/orders/${r.data.MaDonThue}`);
    } catch (error) {
      setErr(getErrMsg(error));
      checkAvail(tuNgay, denNgay);
      loadCar();
    } finally {
      setSubmitting(false);
    }
  };

  if (!car) {
    return (
      <div className="container page">
        {err ? <div className="alert alert-error">{err}</div> : <div className="card">Đang tải thông tin xe...</div>}
      </div>
    );
  }

  const st = CAR_STATUS[car.TrangThai] || { label: car.TrangThai, badge: 'badge-secondary' };
  const mainImg = car.hinhAnh?.[0]?.DuongDan || car.AnhDaiDien;

  return (
    <div className="container page">
      <div style={{ marginBottom: 14 }}>
        <Link to="/" className="btn btn-outline btn-sm">
          ← Quay lại danh sách xe
        </Link>
      </div>

      <div className="grid-2">
        {/* Cột trái: Thông tin xe & Lịch bận */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ aspectRatio: '16/10', background: '#e2e8f0' }}>
              <img src={imgUrl(mainImg)} alt={car.TenXe} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="badge badge-secondary">
                  {car.TenLoai} • {car.SoCho} chỗ
                </span>
                <span className={`badge ${st.badge}`}>{st.label}</span>
              </div>
              <h1 className="page-title">{car.TenXe}</h1>
              <div style={{ color: '#64748b', fontSize: 13.5, marginTop: 4 }}>
                Biển số: <strong>{car.BienSo}</strong> • Hãng: <strong>{car.HangXe}</strong> • Năm SX:{' '}
                <strong>{car.NamSanXuat}</strong>
              </div>
              <p style={{ marginTop: 12, color: '#334155' }}>{car.MoTa}</p>

              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Đơn giá thuê theo ngày</div>
                  <div className="car-price">{formatVND(car.GiaThueNgay)} / ngày</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Tiền đặt cọc chuẩn</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{formatVND(car.TienCoc)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title"> Các khoảng thời gian xe đã có lịch đặt / đang thuê</div>
            {!car.lichBan || car.lichBan.length === 0 ? (
              <div className="alert alert-success" style={{ marginBottom: 0 }}>
                Hiện tại xe chưa có lịch đặt nào trong tương lai.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nhận xe</th>
                      <th>Trả xe</th>
                      <th>Trạng thái đơn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {car.lichBan.map((b, idx) => {
                      const ost = ORDER_STATUS[b.TrangThai] || { label: b.TrangThai, badge: 'badge-secondary' };
                      return (
                        <tr key={idx}>
                          <td>{formatDateTime(b.NgayGioNhan)}</td>
                          <td>{formatDateTime(b.NgayGioTra)}</td>
                          <td>
                            <span className={`badge ${ost.badge}`}>{ost.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Cột phải: Kiểm tra trùng lịch & Đặt xe (UC05, UC06) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <div className="card-title"> Đặt thuê xe & Kiểm tra trùng lịch </div>

            {err && <div className="alert alert-error">{err}</div>}

            <form onSubmit={handleBooking}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Ngày giờ nhận xe *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={tuNgay}
                    onChange={(e) => {
                      setTuNgay(e.target.value);
                      checkAvail(e.target.value, denNgay);
                    }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ngày giờ trả xe *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={denNgay}
                    onChange={(e) => {
                      setDenNgay(e.target.value);
                      checkAvail(tuNgay, e.target.value);
                    }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => checkAvail(tuNgay, denNgay)}
                  disabled={checking}
                >
                  {checking ? 'Đang kiểm tra...' : '🔄 Kiểm tra trùng lịch ngay'}
                </button>
              </div>

              {/* Kết quả kiểm tra khả dụng */}
              {avail && (
                <div className={`alert ${avail.khaDung ? 'alert-success' : 'alert-error'}`}>
                  <div style={{ fontWeight: 700 }}>
                    {avail.khaDung
                      ? '✅ Xe KHẢ DỤNG trong khoảng thời gian bạn chọn!'
                      : `❌ Xe KHÔNG KHẢ DỤNG: ${avail.lyDo}`}
                  </div>
                  {avail.trungLich?.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12.5 }}>
                      Trùng với lịch:{' '}
                      {avail.trungLich.map((t, i) => (
                        <div key={i}>
                          • {formatDateTime(t.NgayGioNhan)} → {formatDateTime(t.NgayGioTra)} ({t.TrangThai})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bảng tính tiền dự kiến */}
              {avail?.baoGia && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                     Bảng tính chi phí dự kiến (làm tròn lên theo ngày 24h)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Số ngày tính tiền:</span>
                    <strong>{avail.baoGia.soNgay} ngày</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Đơn giá thuê:</span>
                    <strong>{formatVND(avail.baoGia.donGia)} / ngày</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Tổng tiền thuê dự kiến ({avail.baoGia.soNgay} × {formatVND(avail.baoGia.donGia)}):</span>
                    <strong style={{ color: '#2563eb', fontSize: 16 }}>{formatVND(avail.baoGia.tienThue)}</strong>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderTop: '1px dashed #cbd5e1',
                      marginTop: 4,
                    }}
                  >
                    <span>Tiền đặt cọc cần thanh toán trước khi nhận xe:</span>
                    <strong style={{ color: '#d97706' }}>{formatVND(avail.baoGia.tienCoc)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13 }}>
                    <span>Còn lại thanh toán khi trả xe (chưa gồm phụ phí nếu có):</span>
                    <strong>{formatVND(avail.baoGia.conLaiKhiNhanXe)}</strong>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Ghi chú đơn thuê (lịch trình, yêu cầu thêm...)</label>
                <textarea
                  className="textarea"
                  value={ghiChu}
                  onChange={(e) => setGhiChu(e.target.value)}
                  placeholder="VD: Thuê xe đi Đà Lạt 3 ngày, nhận xe đúng 8h sáng..."
                />
              </div>

              {!user ? (
                <Link
                  to="/login"
                  state={{ from: `/cars/${id}` }}
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                >
                  Đăng nhập để Đặt thuê xe
                </Link>
              ) : !hasPerm('ORDER_CREATE') ? (
                <div className="alert alert-warning" style={{ marginBottom: 0 }}>
                  Tài khoản hiện tại ({user.TenVaiTro}) không có quyền <code>ORDER_CREATE</code>. Hãy chuyển sang tài
                  khoản Khách hàng để đặt xe.
                </div>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  disabled={submitting || !avail?.khaDung}
                >
                  {submitting ? 'Đang khóa lịch & tạo đơn...' : ' Xác nhận đặt thuê xe'}
                </button>
              )}
            </form>
          </div>

          <div className="card">
            <div className="card-title">📌 Quy định tính tiền, đặt cọc & phụ phí</div>
            <ul style={{ paddingLeft: 18, fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>
                <strong>Công thức tính ngày:</strong> <code>SoNgay = CEILING(Số phút thuê / 1440)</code>, tối thiểu 1 ngày.
              </li>
              <li>
                <strong>Tiền cọc:</strong> <code>MIN(Tiền cọc xe, Tổng tiền thuê)</code> — được khấu trừ trực tiếp vào tổng tiền phải trả.
              </li>
              <li>
                <strong>Phí trả xe trễ:</strong> <code>CEILING(Số phút trễ / 60) × 50.000 đ/giờ</code> (tự động tính khi nhân viên nhận trả xe).
              </li>
              <li>
                <strong>Huỷ đơn:</strong> Miễn phí khi đơn đang <code>PENDING</code>. Nếu đơn đã <code>CONFIRMED</code>, phí huỷ = <code>10% Tổng tiền thuê</code> (khấu trừ vào tiền đã thanh toán, tự động hoàn phần dư).
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
