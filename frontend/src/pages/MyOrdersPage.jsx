import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { imgUrl, getErrMsg } from '../api';
import { ORDER_STATUS, PAYMENT_STATUS, formatDateTime, formatVND } from '../utils/format';

export default function MyOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [trangThai, setTrangThai] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const loadOrders = useCallback(async (st, kw) => {
    setLoading(true);
    setErr('');
    try {
      const params = {};
      if (st) params.trangThai = st;
      if (kw) params.q = kw;
      const r = await api.get('/orders', { params });
      setOrders(r.data);
    } catch (e) {
      setErr(getErrMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders(trangThai, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trangThai]);

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Đơn thuê xe của tôi</h1>
          <p className="page-subtitle">
            Theo dõi trạng thái đơn, hợp đồng, lịch trình nhận – trả xe và thanh toán trực tuyến
          </p>
        </div>
        <Link to="/" className="btn btn-primary">
          + Đặt thuê xe mới
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { k: '', l: 'Tất cả' },
              { k: 'PENDING', l: 'Chờ xác nhận' },
              { k: 'CONFIRMED', l: 'Đã xác nhận' },
              { k: 'RENTING', l: 'Đang thuê' },
              { k: 'RETURNED', l: 'Đã trả xe' },
              { k: 'COMPLETED', l: 'Hoàn tất' },
              { k: 'CANCELLED,REJECTED', l: 'Đã huỷ / Từ chối' },
            ].map((t) => (
              <button
                key={t.k}
                type="button"
                className={`btn btn-sm ${trangThai === t.k ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTrangThai(t.k)}
              >
                {t.l}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadOrders(trangThai, q);
            }}
            style={{ display: 'flex', gap: 8 }}
          >
            <input
              className="input"
              placeholder="Tìm mã đơn, tên xe, biển số..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 230 }}
            />
            <button type="submit" className="btn btn-outline">
              Tìm
            </button>
          </form>
        </div>
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      {loading ? (
        <div className="card">Đang tải danh sách đơn thuê...</div>
      ) : orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          Chưa có đơn thuê nào. <Link to="/" style={{ color: '#2563eb', fontWeight: 600 }}>Chọn xe để đặt ngay</Link>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orders.map((o) => {
            const ost = ORDER_STATUS[o.TrangThai] || { label: o.TrangThai, badge: 'badge-secondary' };
            const pst = PAYMENT_STATUS[o.TrangThaiThanhToan] || { label: o.TrangThaiThanhToan, badge: 'badge-secondary' };
            return (
              <div
                key={o.MaDonThue}
                className="card"
                style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <img
                    src={imgUrl(o.AnhXe)}
                    alt={o.TenXe}
                    style={{ width: 110, height: 74, objectFit: 'cover', borderRadius: 8, background: '#e2e8f0' }}
                  />
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ fontSize: 16 }}>Đơn #{o.MaDonThue}</strong>
                      <span className={`badge ${ost.badge}`}>{ost.label}</span>
                      <span className={`badge ${pst.badge}`}>{pst.label}</span>
                    </div>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>
                      {o.TenXe} ({o.BienSo}) — {o.TenLoai}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#64748b' }}>
                      Nhận: <strong>{formatDateTime(o.NgayGioNhan)}</strong> → Trả:{' '}
                      <strong>{formatDateTime(o.NgayGioTra)}</strong> ({o.SoNgayThue} ngày)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Tổng phải trả</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#2563eb' }}>{formatVND(o.TongTienPhaiTra)}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      Đã trả: {formatVND(o.DaThanhToan)} • Cọc: {formatVND(o.TienCoc)}
                    </div>
                  </div>
                  <Link to={`/orders/${o.MaDonThue}`} className="btn btn-primary">
                    Chi tiết & Xử lý →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
