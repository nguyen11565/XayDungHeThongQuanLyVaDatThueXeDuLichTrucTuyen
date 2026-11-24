import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrMsg } from '../api';
import { ORDER_STATUS, PAYMENT_STATUS, TX_STATUS, formatDateTime, formatVND } from '../utils/format';

export default function StaffPage() {
  const [tab, setTab] = useState('orders');
  const [kpi, setKpi] = useState(null);
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [payments, setPayments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [err, setErr] = useState('');

  const loadAll = useCallback(async () => {
    setErr('');
    try {
      const [kpiRes, ordRes, payRes, hdRes] = await Promise.all([
        api.get('/reports/staff-dashboard'),
        api.get('/orders', { params: { trangThai: statusFilter || undefined, q: q || undefined } }),
        api.get('/payments'),
        api.get('/contracts'),
      ]);
      setKpi(kpiRes.data);
      setOrders(ordRes.data);
      setPayments(payRes.data);
      setContracts(hdRes.data);
    } catch (e) {
      setErr(getErrMsg(e));
    }
  }, [statusFilter, q]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trung tâm Vận hành Thuê xe </h1>
          <p className="page-subtitle">
            Xác nhận đơn, kiểm tra trùng lịch, bàn giao xe, nhận xe trả, tính phụ phí, đối soát thanh toán & quản lý hợp đồng
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={loadAll}>
          🔄 Làm mới dữ liệu
        </button>
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      {/* KPI Cards */}
      {kpi && (
        <div className="grid-4" style={{ marginBottom: 20 }}>
          <div className="stat-card" style={{ borderLeft: '4px solid #d97706' }}>
            <div className="stat-label">Đơn chờ xác nhận (PENDING)</div>
            <div className="stat-value">{kpi.ChoXacNhan}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #0284c7' }}>
            <div className="stat-label">Đã xác nhận / Chờ giao (CONFIRMED)</div>
            <div className="stat-value">
              {kpi.DaXacNhan} <span style={{ fontSize: 13, fontWeight: 500 }}>({kpi.GiaoHomNay} giao hôm nay)</span>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
            <div className="stat-label">Xe đang cho thuê (RENTING)</div>
            <div className="stat-value">
              {kpi.DangThue}{' '}
              {kpi.QuaHanTra > 0 && (
                <span className="badge badge-danger">{kpi.QuaHanTra} quá hạn trả</span>
              )}
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
            <div className="stat-label">Đã trả (RETURNED)</div>
            <div className="stat-value">{kpi.ChoThanhToan}</div>
          </div>
        </div>
      )}

      <div className="tabs">
        <button type="button" className={`tab-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          📋 Quản lý & Xử lý Đơn thuê ({orders.length})
        </button>
        <button type="button" className={`tab-btn ${tab === 'payments' ? 'active' : ''}`} onClick={() => setTab('payments')}>
          💳 Giao dịch Thanh toán ({payments.length})
        </button>
        <button type="button" className={`tab-btn ${tab === 'contracts' ? 'active' : ''}`} onClick={() => setTab('contracts')}>
          📄 Hợp đồng thuê xe ({contracts.length})
        </button>
      </div>

      {tab === 'orders' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { k: '', l: 'Tất cả' },
                { k: 'PENDING', l: '1. Chờ xác nhận' },
                { k: 'CONFIRMED', l: '2. Chờ giao xe' },
                { k: 'RENTING', l: '3. Đang thuê' },
                { k: 'RETURNED', l: '4. Đã trả xe' },
                { k: 'COMPLETED', l: '5. Hoàn tất' },
                { k: 'CANCELLED,REJECTED', l: 'Huỷ / Từ chối' },
              ].map((b) => (
                <button
                  key={b.k}
                  type="button"
                  className={`btn btn-sm ${statusFilter === b.k ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setStatusFilter(b.k)}
                >
                  {b.l}
                </button>
              ))}
            </div>
            <input
              className="input"
              placeholder="Tìm mã đơn, tên khách, SĐT, biển số..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 260 }}
            />
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Xe & Biển số</th>
                  <th>Nhận → Trả</th>
                  <th>Tổng phải trả / Đã trả</th>
                  <th>Trạng thái đơn</th>
                  <th>TT Thanh toán</th>
                  <th>Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const ost = ORDER_STATUS[o.TrangThai] || { label: o.TrangThai, badge: 'badge-secondary' };
                  const pst = PAYMENT_STATUS[o.TrangThaiThanhToan] || { label: o.TrangThaiThanhToan, badge: 'badge-secondary' };
                  return (
                    <tr key={o.MaDonThue}>
                      <td>
                        <strong>#{o.MaDonThue}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.TenKhachHang}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{o.SdtKhachHang || o.EmailKhachHang}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.TenXe}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{o.BienSo}</div>
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        <div>{formatDateTime(o.NgayGioNhan)}</div>
                        <div>→ {formatDateTime(o.NgayGioTra)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#2563eb' }}>{formatVND(o.TongTienPhaiTra)}</div>
                        <div style={{ fontSize: 12, color: '#059669' }}>Đã trả: {formatVND(o.DaThanhToan)}</div>
                      </td>
                      <td>
                        <span className={`badge ${ost.badge}`}>{ost.label}</span>
                      </td>
                      <td>
                        <span className={`badge ${pst.badge}`}>{pst.label}</span>
                      </td>
                      <td>
                        <Link to={`/orders/${o.MaDonThue}`} className="btn btn-primary btn-sm">
                          Mở xử lý →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="card">
          <div className="card-title">Danh sách giao dịch thanh toán </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã GD</th>
                  <th>Đơn</th>
                  <th>Khách hàng</th>
                  <th>Loại / Phương thức</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const tst = TX_STATUS[p.TrangThai] || { label: p.TrangThai, badge: 'badge-secondary' };
                  return (
                    <tr key={p.MaThanhToan}>
                      <td>
                        <code>{p.MaGiaoDich || `#${p.MaThanhToan}`}</code>
                      </td>
                      <td>
                        <Link to={`/orders/${p.MaDonThue}`} style={{ color: '#2563eb', fontWeight: 700 }}>
                          #{p.MaDonThue} ({p.BienSo})
                        </Link>
                      </td>
                      <td>{p.TenKhachHang}</td>
                      <td>
                        {p.LoaiThanhToan} • <code>{p.PhuongThuc}</code>
                      </td>
                      <td style={{ fontWeight: 700 }}>{formatVND(p.SoTien)}</td>
                      <td>
                        <span className={`badge ${tst.badge}`}>{tst.label}</span>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{formatDateTime(p.ThoiGianTao)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'contracts' && (
        <div className="card">
          <div className="card-title">Danh sách Hợp đồng thuê xe </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Số hợp đồng</th>
                  <th>Đơn thuê</th>
                  <th>Khách hàng</th>
                  <th>Xe</th>
                  <th>Tổng giá trị</th>
                  <th>Trạng thái HĐ</th>
                  <th>Ngày lập</th>
                  <th>Xem</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.MaHopDong}>
                    <td>
                      <strong>{c.SoHopDong}</strong>
                    </td>
                    <td>#{c.MaDonThue}</td>
                    <td>{c.TenKhachHang}</td>
                    <td>
                      {c.TenXe} ({c.BienSo})
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatVND(c.TongTienPhaiTra)}</td>
                    <td>
                      <span className="badge badge-info">{c.TrangThai}</span>
                    </td>
                    <td>{formatDateTime(c.NgayLap)}</td>
                    <td>
                      <Link to={`/orders/${c.MaDonThue}`} className="btn btn-outline btn-sm">
                        Chi tiết HĐ →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
