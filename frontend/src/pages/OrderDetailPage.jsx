import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { imgUrl, getErrMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  CAR_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  TX_STATUS,
  FEE_TYPES,
  formatDateTime,
  formatVND,
  toInputDateTime,
} from '../utils/format';

const STEPS = [
  { key: 'PENDING', label: '1. Tạo đơn (PENDING)' },
  { key: 'CONFIRMED', label: '2. Đã xác nhận & Cọc' },
  { key: 'RENTING', label: '3. Giao xe (RENTING)' },
  { key: 'RETURNED', label: '4. Trả xe & Phụ phí' },
  { key: 'COMPLETED', label: '5. Hoàn tất (COMPLETED)' },
];

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user, hasPerm, fetchUnread } = useAuth();

  const [order, setOrder] = useState(null);
  const [conflictInfo, setConflictInfo] = useState(null);
  const [contract, setContract] = useState(null);
  const [showContractModal, setShowContractModal] = useState(false);
  const [editingContract, setEditingContract] = useState(false);
  const [contractText, setContractText] = useState('');

  // Sandbox Payment Gateway modal
  const [sandboxTx, setSandboxTx] = useState(null);
  const [payMethod, setPayMethod] = useState('SANDBOX');

  // Staff forms
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [handoverForm, setHandoverForm] = useState({
    thoiGianGiao: toInputDateTime(),
    soKm: 12000,
    mucNhienLieu: 100,
    tinhTrangXe: 'Xe sạch sẽ, đầy đủ giấy tờ, không trầy xước',
    ghiChu: '',
  });
  const [returnForm, setReturnForm] = useState({
    thoiGianTra: toInputDateTime(),
    soKm: 12350,
    mucNhienLieu: 90,
    tinhTrangXe: 'Xe hoạt động bình thường',
    canBaoTri: false,
    ghiChu: '',
    phiPhatSinh: [],
  });
  const [extraFeeForm, setExtraFeeForm] = useState({ loaiPhi: 'CLEANING', soTien: 200000, lyDo: 'Vệ sinh nội thất xe' });
  const [counterPayForm, setCounterPayForm] = useState({ soTien: '', phuongThuc: 'CASH', ghiChu: 'Thu tiền tại quầy' });

  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const r = await api.get(`/orders/${id}`);
      const d = r.data;
      setOrder(d);
      setCounterPayForm((f) => ({ ...f, soTien: Math.max(0, d.conLai) }));
      if (d.phieuGiao) {
        setReturnForm((f) => ({
          ...f,
          soKm: Number(d.phieuGiao.SoKm) + 250,
          thoiGianTra: toInputDateTime(new Date(d.NgayGioTra)),
        }));
      }
      if (hasPerm('ORDER_PROCESS') && d.TrangThai === 'PENDING') {
        const cf = await api.get(`/orders/${id}/check-conflict`);
        setConflictInfo(cf.data);
      } else {
        setConflictInfo(null);
      }
    } catch (e) {
      setErr(getErrMsg(e));
    }
  }, [id, hasPerm]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const runAction = async (fn) => {
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const m = await fn();
      if (m) setMsg(m);
      await loadOrder();
      await fetchUnread();
    } catch (e) {
      setErr(getErrMsg(e));
    } finally {
      setBusy(false);
    }
  };

  // --- Khách tạo giao dịch thanh toán ---
  const startPayment = (loaiThanhToan) =>
    runAction(async () => {
      const r = await api.post('/payments', {
        maDonThue: order.MaDonThue,
        loaiThanhToan,
        phuongThuc: payMethod,
      });
      if (payMethod === 'SANDBOX') {
        setSandboxTx(r.data);
        return null;
      }
      return `Đã tạo yêu cầu chuyển khoản ${r.data.MaGiaoDich}. Nhân viên sẽ kiểm tra và xác nhận.`;
    });

  const completeSandbox = (ketQua, lyDo) =>
    runAction(async () => {
      const r = await api.post(`/payments/${sandboxTx.MaThanhToan}/sandbox`, { ketQua, lyDo });
      setSandboxTx(null);
      return `Kết quả cổng Sandbox (${r.data.MaGiaoDich}): ${r.data.TrangThai}`;
    });

  // --- Xem / sửa hợp đồng ---
  const openContract = async () => {
    setErr('');
    try {
      const r = await api.get(`/contracts/order/${order.MaDonThue}`);
      setContract(r.data);
      setContractText(r.data.NoiDung);
      setEditingContract(false);
      setShowContractModal(true);
    } catch (e) {
      setErr(getErrMsg(e));
    }
  };

  const saveContract = () =>
    runAction(async () => {
      const r = await api.put(`/contracts/${contract.MaHopDong}`, { noiDung: contractText });
      const updated = await api.get(`/contracts/order/${order.MaDonThue}`);
      setContract(updated.data);
      setEditingContract(false);
      return r.data.message;
    });

  if (!order) {
    return (
      <div className="container page">
        {err ? <div className="alert alert-error">{err}</div> : <div className="card">Đang tải chi tiết đơn thuê...</div>}
      </div>
    );
  }

  const ost = ORDER_STATUS[order.TrangThai] || { label: order.TrangThai, badge: 'badge-secondary', step: 0 };
  const pst = PAYMENT_STATUS[order.TrangThaiThanhToan] || { label: order.TrangThaiThanhToan, badge: 'badge-secondary' };
  const cst = CAR_STATUS[order.TrangThaiXe] || { label: order.TrangThaiXe, badge: 'badge-secondary' };

  const isOwner = user?.MaNguoiDung === order.MaKhachHang;
  const canConfirm = hasPerm('ORDER_CONFIRM');
  const canHandover = hasPerm('CAR_HANDOVER');
  const canReturn = hasPerm('CAR_RETURN');
  const canFee = hasPerm('EXTRA_FEE_MANAGE');
  const canPayStaff = hasPerm('PAYMENT_PROCESS');
  const canContract = hasPerm('CONTRACT_MANAGE');

  const needDeposit = Math.max(0, Number(order.TienCoc) - Number(order.DaThanhToan));
  const needRemaining = Math.max(0, Number(order.conLai));

  // Ước tính phí trả trễ ngay trên form trả xe
  const calcPreviewLate = () => {
    if (!returnForm.thoiGianTra) return { gio: 0, phi: 0 };
    const expected = new Date(order.NgayGioTra).getTime();
    const actual = new Date(returnForm.thoiGianTra).getTime();
    if (actual <= expected) return { gio: 0, phi: 0 };
    const gio = Math.ceil((actual - expected) / (60 * 60000));
    return { gio, phi: gio * 50000 };
  };
  const latePreview = calcPreviewLate();

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <Link to={hasPerm('ORDER_PROCESS') ? '/staff' : '/my-orders'} className="btn btn-outline btn-sm">
              ← Danh sách đơn
            </Link>
            <span className={`badge ${ost.badge}`}>{ost.label}</span>
            <span className={`badge ${pst.badge}`}>{pst.label}</span>
            <span className={`badge ${cst.badge}`}>Xe: {cst.label}</span>
          </div>
          <h1 className="page-title">
            Đơn thuê #{order.MaDonThue} — {order.TenXe} ({order.BienSo})
          </h1>
          <p className="page-subtitle">
            Khách hàng: <strong>{order.TenKhachHang}</strong> ({order.EmailKhachHang} • {order.SdtKhachHang || '—'})
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {order.hopDong && (
            <button type="button" className="btn btn-outline" onClick={openContract}>
              📄 Xem Hợp đồng ({order.hopDong.SoHopDong} - {order.hopDong.TrangThai})
            </button>
          )}
        </div>
      </div>

      {/* Stepper quy trình End-to-End */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
          Quy trình thuê xe End-to-End (State Flow)
        </div>
        <div className="stepper">
          {STEPS.map((s, idx) => {
            const stepNum = idx + 1;
            const cls = ost.step > stepNum || order.TrangThai === 'COMPLETED' ? 'done' : ost.step === stepNum ? 'active' : '';
            return (
              <div key={s.key} className={`step-item ${cls}`}>
                <span className="step-num">{cls === 'done' ? '✓' : stepNum}</span>
                <div style={{ fontSize: 13 }}>{s.label}</div>
              </div>
            );
          })}
        </div>
        {(order.TrangThai === 'CANCELLED' || order.TrangThai === 'REJECTED') && (
          <div className="alert alert-error" style={{ marginBottom: 0 }}>
            <strong>Đơn đã {order.TrangThai === 'CANCELLED' ? 'HUỶ' : 'BỊ TỪ CHỐI'}:</strong>{' '}
            {order.LyDoHuy || order.LyDoTuChoi || 'Không có lý do chi tiết.'}
          </div>
        )}
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="grid-2">
        {/* Cột trái: Thông tin xe, Tài chính, Thanh toán của khách */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <div className="card-title">🚘 Thông tin xe & Lịch trình thuê</div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
              <img
                src={imgUrl(order.AnhXe)}
                alt={order.TenXe}
                style={{ width: 130, height: 86, objectFit: 'cover', borderRadius: 10 }}
              />
              <div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>
                  {order.TenXe} ({order.BienSo})
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Loại: {order.TenLoai} ({order.SoCho} chỗ) • Trạng thái xe hiện tại:{' '}
                  <span className={`badge ${cst.badge}`}>{cst.label}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Đơn giá: <strong>{formatVND(order.DonGiaNgay)}/ngày</strong> × <strong>{order.SoNgayThue} ngày</strong>
                </div>
              </div>
            </div>
            <div className="grid-2" style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Thời gian nhận xe dự kiến</div>
                <strong>{formatDateTime(order.NgayGioNhan)}</strong>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Thời gian trả xe dự kiến</div>
                <strong>{formatDateTime(order.NgayGioTra)}</strong>
              </div>
            </div>
            {order.GhiChu && (
              <div style={{ marginTop: 10, fontSize: 13, color: '#475569' }}>
                <strong>Ghi chú của khách:</strong> {order.GhiChu}
              </div>
            )}
          </div>

          {/* Bảng đối chiếu chi phí */}
          <div className="card">
            <div className="card-title"> Bảng tính tiền, đặt cọc & phụ phí phát sinh</div>
            <table className="table">
              <tbody>
                <tr>
                  <td>Tiền thuê gốc ({order.SoNgayThue} ngày × {formatVND(order.DonGiaNgay)})</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatVND(order.TongTienDuKien)}</td>
                </tr>
                <tr>
                  <td>Mức tiền cọc bắt buộc trước khi giao xe</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#d97706' }}>{formatVND(order.TienCoc)}</td>
                </tr>
                <tr>
                  <td>Tổng phụ phí phát sinh (trả trễ, vệ sinh, nhiên liệu, hư hỏng, phí huỷ)</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                    + {formatVND(order.TongPhiPhatSinh)}
                  </td>
                </tr>
                <tr style={{ background: '#eff6ff' }}>
                  <td>
                    <strong>TỔNG CỘNG PHẢI TRẢ (Tiền thuê + Phụ phí)</strong>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 16, color: '#2563eb' }}>
                    {formatVND(order.TongTienPhaiTra)}
                  </td>
                </tr>
                <tr>
                  <td>Đã thanh toán thuần (trừ hoàn tiền nếu có)</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                    {formatVND(order.DaThanhToan)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>SỐ TIỀN CÒN PHẢI THANH TOÁN</strong>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 16, color: needRemaining > 0 ? '#dc2626' : '#059669' }}>
                    {formatVND(needRemaining)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Chi tiết các khoản phí phát sinh */}
            {order.phiPhatSinh?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Chi tiết các khoản phí phát sinh:</div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Loại phí</th>
                      <th>Lý do</th>
                      <th style={{ textAlign: 'right' }}>Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.phiPhatSinh.map((f) => (
                      <tr key={f.MaPhi}>
                        <td>
                          <span className="badge badge-danger">{FEE_TYPES[f.LoaiPhi] || f.LoaiPhi}</span>
                        </td>
                        <td>{f.LyDo}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatVND(f.SoTien)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Hành động của Khách hàng: Thanh toán Sandbox & Huỷ đơn */}
          {isOwner && hasPerm('PAYMENT_CREATE') && ['PENDING', 'CONFIRMED', 'RENTING', 'RETURNED'].includes(order.TrangThai) && needRemaining > 0 && (
            <div className="card" style={{ border: '2px solid #2563eb' }}>
              <div className="card-title"> Thanh toán trực tuyến</div>
              <div className="form-group">
                <label className="form-label">Chọn phương thức thanh toán</label>
                <select className="select" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="SANDBOX">Cổng thanh toán Sandbox (Mô phỏng kết quả Thành công / Thất bại tức thì)</option>
                  <option value="BANK_TRANSFER">Chuyển khoản ngân hàng (Chờ nhân viên đối soát & duyệt)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {needDeposit > 0 && (
                  <button
                    type="button"
                    className="btn btn-warning"
                    disabled={busy}
                    onClick={() => startPayment('DEPOSIT')}
                  >
                    Thanh toán Tiền cọc ({formatVND(needDeposit)})
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => startPayment('FULL')}
                >
                  Thanh toán Toàn bộ số còn lại ({formatVND(needRemaining)})
                </button>
              </div>
            </div>
          )}

          {/* Huỷ đơn (Khách hàng hoặc Nhân viên) */}
          {['PENDING', 'CONFIRMED'].includes(order.TrangThai) && (isOwner || canConfirm) && (
            <div className="card">
              <div className="card-title">Huỷ đơn thuê xe </div>
              {order.TrangThai === 'CONFIRMED' && (
                <div className="alert alert-warning">
                  Lưu ý: Đơn đã được <strong>CONFIRMED</strong>. Theo quy tắc phí, huỷ sau khi xác nhận sẽ chịu phí huỷ{' '}
                  <strong>10% tiền thuê ({formatVND(Math.round(order.TongTienDuKien * 0.1))})</strong> khấu trừ vào số tiền đã thanh toán; phần dư được hoàn tự động.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder="Nhập lý do huỷ đơn..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() =>
                    runAction(async () => {
                      const r = await api.post(`/orders/${order.MaDonThue}/cancel`, {
                        lyDo: cancelReason || 'Thay đổi kế hoạch di chuyển',
                      });
                      return r.data.message;
                    })
                  }
                >
                  Xác nhận Huỷ đơn
                </button>
              </div>
            </div>
          )}

          {/* Phiếu giao & Phiếu trả xe */}
          {(order.phieuGiao || order.phieuTra) && (
            <div className="card">
              <div className="card-title">Biên bản Giao xe & Nhận trả xe</div>
              <div className="grid-2">
                {order.phieuGiao && (
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, color: '#2563eb', marginBottom: 6 }}>Phiếu Giao Xe </div>
                    <div>Thời điểm giao: <strong>{formatDateTime(order.phieuGiao.ThoiGianGiao)}</strong></div>
                    <div>Số ODO lúc giao: <strong>{order.phieuGiao.SoKm} km</strong></div>
                    <div>Mức nhiên liệu: <strong>{order.phieuGiao.MucNhienLieu}%</strong></div>
                    <div>Tình trạng: <strong>{order.phieuGiao.TinhTrangXe}</strong></div>
                    <div>Nhân viên giao: {order.phieuGiao.TenNhanVien}</div>
                  </div>
                )}
                {order.phieuTra && (
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, color: '#059669', marginBottom: 6 }}>Phiếu Trả Xe </div>
                    <div>Thời điểm trả: <strong>{formatDateTime(order.phieuTra.ThoiGianTra)}</strong></div>
                    <div>Số ODO lúc trả: <strong>{order.phieuTra.SoKm} km</strong></div>
                    <div>Mức nhiên liệu: <strong>{order.phieuTra.MucNhienLieu}%</strong></div>
                    <div>Tình trạng: <strong>{order.phieuTra.TinhTrangXe}</strong></div>
                    <div>Chuyển bảo trì: <strong>{order.phieuTra.CanBaoTri ? 'Có (MAINTENANCE)' : 'Không'}</strong></div>
                    <div>Nhân viên nhận: {order.phieuTra.TenNhanVien}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cột phải: Bảng điều khiển Nhân viên vận hành + Lịch sử giao dịch + Audit Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* 1. Xử lý & Xác nhận / Từ chối đơn (PENDING) */}
          {canConfirm && order.TrangThai === 'PENDING' && (
            <div className="card" style={{ border: '2px solid #0284c7' }}>
              <div className="card-title"> Nghiệp vụ Nhân viên: Kiểm tra & Xác nhận đơn </div>
              {conflictInfo && (
                <div className={`alert ${conflictInfo.coTheXacNhan ? 'alert-success' : 'alert-error'}`}>
                  <div>
                    Trạng thái xe: <strong>{conflictInfo.trangThaiXe}</strong> • Xung đột với đơn đã xác nhận:{' '}
                    <strong>{conflictInfo.xungDot?.length || 0}</strong>
                  </div>
                  {conflictInfo.donChoKhac?.length > 0 && (
                    <div style={{ fontSize: 12.5, marginTop: 4 }}>
                      Có {conflictInfo.donChoKhac.length} đơn PENDING khác trùng giờ đang chờ xử lý.
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                className="btn btn-success btn-lg"
                style={{ width: '100%', marginBottom: 12 }}
                disabled={busy || (conflictInfo && !conflictInfo.coTheXacNhan)}
                onClick={() =>
                  runAction(async () => {
                    const r = await api.post(`/orders/${order.MaDonThue}/confirm`);
                    return r.data.message;
                  })
                }
              >
                ✅ Xác nhận đơn thuê & Tự động lập Hợp đồng nháp
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder="Lý do từ chối đơn (bắt buộc khi từ chối)..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() =>
                    runAction(async () => {
                      const r = await api.post(`/orders/${order.MaDonThue}/reject`, { lyDo: rejectReason });
                      return r.data.message;
                    })
                  }
                >
                  Từ chối
                </button>
              </div>
            </div>
          )}

          {/* 2. Bàn giao xe (CONFIRMED -> RENTING) */}
          {canHandover && order.TrangThai === 'CONFIRMED' && (
            <div className="card" style={{ border: '2px solid #2563eb' }}>
              <div className="card-title"> Nghiệp vụ Nhân viên: Bàn giao xe cho khách </div>
              {needDeposit > 0 && (
                <div className="alert alert-warning">
                  ⚠️ Khách hàng còn thiếu <strong>{formatVND(needDeposit)}</strong> tiền đặt cọc. Hệ thống sẽ chặn giao xe cho tới khi thu đủ tiền cọc (qua Sandbox hoặc Thu tại quầy bên dưới).
                </div>
              )}
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Thời điểm giao *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={handoverForm.thoiGianGiao}
                    onChange={(e) => setHandoverForm({ ...handoverForm, thoiGianGiao: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Số km (ODO) *</label>
                  <input
                    type="number"
                    className="input"
                    value={handoverForm.soKm}
                    onChange={(e) => setHandoverForm({ ...handoverForm, soKm: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nhiên liệu (%) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input"
                    value={handoverForm.mucNhienLieu}
                    onChange={(e) => setHandoverForm({ ...handoverForm, mucNhienLieu: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tình trạng xe lúc bàn giao *</label>
                <input
                  className="input"
                  value={handoverForm.tinhTrangXe}
                  onChange={(e) => setHandoverForm({ ...handoverForm, tinhTrangXe: e.target.value })}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                disabled={busy}
                onClick={() =>
                  runAction(async () => {
                    const r = await api.post(`/orders/${order.MaDonThue}/handover`, handoverForm);
                    return r.data.message;
                  })
                }
              >
                Xác nhận Giao xe (Chuyển đơn & xe sang RENTING, kích hoạt Hợp đồng ACTIVE)
              </button>
            </div>
          )}

          {/* 3. Nhận trả xe & Tính phí phát sinh (RENTING -> RETURNED) */}
          {canReturn && order.TrangThai === 'RENTING' && (
            <div className="card" style={{ border: '2px solid #059669' }}>
              <div className="card-title">🏁 Nghiệp vụ Nhân viên: Nhận xe trả & Tính phí phát sinh (UC14, UC15)</div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Thời điểm trả thực tế *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={returnForm.thoiGianTra}
                    onChange={(e) => setReturnForm({ ...returnForm, thoiGianTra: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Số km lúc trả (&gt;= {order.phieuGiao?.SoKm || 0}) *</label>
                  <input
                    type="number"
                    className="input"
                    value={returnForm.soKm}
                    onChange={(e) => setReturnForm({ ...returnForm, soKm: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nhiên liệu lúc trả (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input"
                    value={returnForm.mucNhienLieu}
                    onChange={(e) => setReturnForm({ ...returnForm, mucNhienLieu: e.target.value })}
                  />
                </div>
              </div>

              {latePreview.gio > 0 && (
                <div className="alert alert-warning">
                  Phát hiện trả xe trễ <strong>{latePreview.gio} giờ</strong> so với hạn ({formatDateTime(order.NgayGioTra)}).
                  Hệ thống sẽ tự động cộng phí trả trễ: <strong>{formatVND(latePreview.phi)}</strong> (50.000 đ/giờ).
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Tình trạng xe khi nhận lại *</label>
                <input
                  className="input"
                  value={returnForm.tinhTrangXe}
                  onChange={(e) => setReturnForm({ ...returnForm, tinhTrangXe: e.target.value })}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={returnForm.canBaoTri}
                  onChange={(e) => setReturnForm({ ...returnForm, canBaoTri: e.target.checked })}
                />
                Đánh dấu xe cần đưa vào Bảo trì (MAINTENANCE) ngay sau khi trả
              </label>

              <button
                type="button"
                className="btn btn-success btn-lg"
                style={{ width: '100%' }}
                disabled={busy}
                onClick={() =>
                  runAction(async () => {
                    const r = await api.post(`/orders/${order.MaDonThue}/return`, returnForm);
                    return r.data.message;
                  })
                }
              >
                 Ghi nhận Trả xe & Tự động tính phí trễ (nếu có)
              </button>
            </div>
          )}

          {/* 4. Thêm phụ phí phát sinh (RENTING / RETURNED) */}
          {canFee && ['RENTING', 'RETURNED'].includes(order.TrangThai) && (
            <div className="card">
              <div className="card-title"> Ghi nhận thêm phụ phí (Vệ sinh / Nhiên liệu / Hư hỏng )</div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Loại phí</label>
                  <select
                    className="select"
                    value={extraFeeForm.loaiPhi}
                    onChange={(e) => {
                      const lp = e.target.value;
                      const defAmount = lp === 'CLEANING' ? 200000 : lp === 'FUEL' ? 300000 : 500000;
                      setExtraFeeForm({ ...extraFeeForm, loaiPhi: lp, soTien: defAmount });
                    }}
                  >
                    <option value="CLEANING">CLEANING - Vệ sinh (200k)</option>
                    <option value="FUEL">FUEL - Bù nhiên liệu (300k)</option>
                    <option value="DAMAGE">DAMAGE - Hư hỏng / trầy xước</option>
                    <option value="OTHER">OTHER - Phụ phí khác</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Số tiền (VNĐ)</label>
                  <input
                    type="number"
                    className="input"
                    value={extraFeeForm.soTien}
                    onChange={(e) => setExtraFeeForm({ ...extraFeeForm, soTien: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Lý do chi tiết</label>
                  <input
                    className="input"
                    value={extraFeeForm.lyDo}
                    onChange={(e) => setExtraFeeForm({ ...extraFeeForm, lyDo: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() =>
                  runAction(async () => {
                    const r = await api.post(`/orders/${order.MaDonThue}/fees`, extraFeeForm);
                    return r.data.message;
                  })
                }
              >
                + Thêm khoản phụ phí vào đơn
              </button>
            </div>
          )}

          {/* 5. Nhân viên thu tiền tại quầy & Hoàn tất đơn (UC16) */}
          {canPayStaff && ['PENDING', 'CONFIRMED', 'RENTING', 'RETURNED'].includes(order.TrangThai) && (
            <div className="card">
              <div className="card-title">Nghiệp vụ Nhân viên: Xử lý thanh toán & Hoàn tất đơn </div>
              {needRemaining > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div className="grid-3">
                    <div className="form-group">
                      <label className="form-label">Số tiền thu (còn nợ {formatVND(needRemaining)})</label>
                      <input
                        type="number"
                        className="input"
                        value={counterPayForm.soTien}
                        onChange={(e) => setCounterPayForm({ ...counterPayForm, soTien: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phương thức</label>
                      <select
                        className="select"
                        value={counterPayForm.phuongThuc}
                        onChange={(e) => setCounterPayForm({ ...counterPayForm, phuongThuc: e.target.value })}
                      >
                        <option value="CASH">Tiền mặt tại quầy (CASH)</option>
                        <option value="BANK_TRANSFER">Chuyển khoản (BANK_TRANSFER)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ghi chú</label>
                      <input
                        className="input"
                        value={counterPayForm.ghiChu}
                        onChange={(e) => setCounterPayForm({ ...counterPayForm, ghiChu: e.target.value })}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      runAction(async () => {
                        const r = await api.post('/payments/counter', {
                          maDonThue: order.MaDonThue,
                          soTien: Number(counterPayForm.soTien),
                          loaiThanhToan: Number(counterPayForm.soTien) >= needRemaining ? 'FULL' : 'DEPOSIT',
                          phuongThuc: counterPayForm.phuongThuc,
                          ghiChu: counterPayForm.ghiChu,
                        });
                        return r.data.message;
                      })
                    }
                  >
                    Ghi nhận đã thu tiền
                  </button>
                </div>
              )}

              {order.TrangThai === 'RETURNED' && (
                <button
                  type="button"
                  className="btn btn-success btn-lg"
                  style={{ width: '100%' }}
                  disabled={busy}
                  onClick={() =>
                    runAction(async () => {
                      const r = await api.post(`/orders/${order.MaDonThue}/complete`);
                      return r.data.message;
                    })
                  }
                >
                  Chốt & Hoàn tất đơn thuê (COMPLETED)
                </button>
              )}
            </div>
          )}

          {/* Danh sách giao dịch thanh toán */}
          <div className="card">
            <div className="card-title"> Lịch sử giao dịch thanh toán ({order.thanhToan?.length || 0})</div>
            {!order.thanhToan?.length ? (
              <div style={{ color: '#64748b', fontSize: 13 }}>Chưa có giao dịch thanh toán nào.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mã GD</th>
                      <th>Loại / P.Thức</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.thanhToan.map((t) => {
                      const tst = TX_STATUS[t.TrangThai] || { label: t.TrangThai, badge: 'badge-secondary' };
                      return (
                        <tr key={t.MaThanhToan}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{t.MaGiaoDich || `#${t.MaThanhToan}`}</div>
                            <div style={{ fontSize: 11.5, color: '#64748b' }}>{formatDateTime(t.ThoiGianTao)}</div>
                          </td>
                          <td>
                            {t.LoaiThanhToan} / <code>{t.PhuongThuc}</code>
                          </td>
                          <td style={{ fontWeight: 700, color: t.LoaiThanhToan === 'REFUND' ? '#7c3aed' : '#0f172a' }}>
                            {t.LoaiThanhToan === 'REFUND' ? '- ' : ''}
                            {formatVND(t.SoTien)}
                          </td>
                          <td>
                            <span className={`badge ${tst.badge}`}>{tst.label}</span>
                          </td>
                          <td>
                            {canPayStaff && t.TrangThai === 'PENDING' && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm"
                                  onClick={() =>
                                    runAction(async () => {
                                      await api.post(`/payments/${t.MaThanhToan}/verify`, {
                                        ketQua: 'SUCCESS',
                                        ghiChu: 'Nhân viên xác nhận đã nhận tiền',
                                      });
                                      return 'Đã xác nhận giao dịch thành công.';
                                    })
                                  }
                                >
                                  Duyệt
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() =>
                                    runAction(async () => {
                                      await api.post(`/payments/${t.MaThanhToan}/verify`, {
                                        ketQua: 'FAILED',
                                        ghiChu: 'Không nhận được khoản chuyển',
                                      });
                                      return 'Đã đánh dấu giao dịch thất bại.';
                                    })
                                  }
                                >
                                  Từ chối
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Nhật ký thay đổi của đơn (Audit Log) */}
          <div className="card">
            <div className="card-title"> Lịch sử thay đổi trên đơn </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(order.lichSu || []).map((a) => (
                <div
                  key={a.MaLog}
                  style={{
                    fontSize: 12.5,
                    padding: '8px 10px',
                    background: '#f8fafc',
                    borderRadius: 8,
                    borderLeft: '3px solid #2563eb',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>
                      [{a.LoaiDoiTuong}] {a.HanhDong} — {a.HoTen || 'Hệ thống'} ({a.VaiTro || '—'})
                    </strong>
                    <span style={{ color: '#64748b' }}>{formatDateTime(a.ThoiGian)}</span>
                  </div>
                  {(a.GiaTriCu || a.GiaTriMoi) && (
                    <div style={{ color: '#475569', marginTop: 2, wordBreak: 'break-all' }}>
                      {a.GiaTriCu ? `${a.GiaTriCu} → ` : ''}
                      {a.GiaTriMoi}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Cổng thanh toán Sandbox */}
      {sandboxTx && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 800 }}> Cổng Thanh toán Trực tuyến Sandbox</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setSandboxTx(null)}>
                ✕
              </button>
            </div>
            <div className="alert alert-info">
              Môi trường <strong>SANDBOX</strong> phục vụ kiểm thử đồ án: bạn có thể chọn kết quả trả về từ cổng thanh toán để kiểm chứng cả trường hợp <strong>Thành công (SUCCESS)</strong> và <strong>Thất bại (FAILED - TC09/TC14)</strong>.
            </div>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, marginBottom: 16 }}>
              <div>Mã giao dịch: <strong>{sandboxTx.MaGiaoDich}</strong></div>
              <div>Đơn thuê: <strong>#{sandboxTx.MaDonThue}</strong></div>
              <div>Loại thanh toán: <strong>{sandboxTx.LoaiThanhToan}</strong></div>
              <div>Số tiền: <strong style={{ fontSize: 18, color: '#2563eb' }}>{formatVND(sandboxTx.SoTien)}</strong></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                className="btn btn-success btn-lg"
                disabled={busy}
                onClick={() => completeSandbox('SUCCESS')}
              >
                ✅ Thanh toán THÀNH CÔNG 
              </button>
              <button
                type="button"
                className="btn btn-danger btn-lg"
                disabled={busy}
                onClick={() => completeSandbox('FAILED', 'Sandbox: Thẻ không đủ hạn mức / Bị ngân hàng từ chối')}
              >
                ❌ Giao dịch THẤT BẠI 
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => completeSandbox('CANCELLED', 'Khách hàng huỷ trên cổng thanh toán')}
              >
                Huỷ giao dịch (CANCELLED)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hợp đồng thuê xe */}
      {showContractModal && contract && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h3 style={{ fontWeight: 800 }}>
                  Hợp đồng #{contract.SoHopDong} <span className="badge badge-info">{contract.TrangThai}</span>
                </h3>
                <div style={{ fontSize: 12, color: '#64748b' }}>Ngày lập: {formatDateTime(contract.NgayLap)}</div>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowContractModal(false)}>
                Đóng
              </button>
            </div>

            {editingContract ? (
              <div>
                <textarea
                  className="textarea"
                  style={{ minHeight: 280, fontFamily: 'monospace' }}
                  value={contractText}
                  onChange={(e) => setContractText(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn btn-primary" onClick={saveContract} disabled={busy}>
                    Lưu nội dung hợp đồng
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setEditingContract(false)}>
                    Huỷ sửa
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: 16,
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    lineHeight: 1.65,
                  }}
                >
                  {contract.NoiDung}
                </pre>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                  {canContract && contract.TrangThai === 'DRAFT' && (
                    <button type="button" className="btn btn-outline" onClick={() => setEditingContract(true)}>
                       Chỉnh sửa điều khoản (khi còn DRAFT)
                    </button>
                  )}
                  <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                     In hợp đồng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
