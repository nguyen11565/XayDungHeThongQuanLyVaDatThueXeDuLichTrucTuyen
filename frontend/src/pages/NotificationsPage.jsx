import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/format';

const TYPE_BADGE = {
  ORDER_CREATED: { label: 'Tạo đơn', cls: 'badge-info' },
  ORDER_CONFIRMED: { label: 'Xác nhận đơn', cls: 'badge-primary' },
  ORDER_REJECTED: { label: 'Từ chối đơn', cls: 'badge-danger' },
  ORDER_CANCELLED: { label: 'Huỷ đơn', cls: 'badge-secondary' },
  PAYMENT_SUCCESS: { label: 'Thanh toán thành công', cls: 'badge-success' },
  PAYMENT_FAILED: { label: 'Thanh toán thất bại', cls: 'badge-danger' },
  PAYMENT_REFUNDED: { label: 'Hoàn tiền', cls: 'badge-purple' },
  PICKUP_REMINDER: { label: 'Nhắc nhận xe', cls: 'badge-warning' },
  CAR_HANDED_OVER: { label: 'Đã giao xe', cls: 'badge-primary' },
  CAR_RETURNED: { label: 'Đã trả xe', cls: 'badge-info' },
  EXTRA_FEE: { label: 'Phụ phí phát sinh', cls: 'badge-warning' },
  ORDER_COMPLETED: { label: 'Hoàn tất đơn', cls: 'badge-success' },
};

export default function NotificationsPage() {
  const { hasPerm, fetchUnread } = useAuth();
  const [items, setItems] = useState([]);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async (unread) => {
    try {
      const r = await api.get('/notifications', { params: unread ? { chuaDoc: 1 } : {} });
      setItems(r.data);
    } catch (e) {
      setErr(getErrMsg(e));
    }
  }, []);

  useEffect(() => {
    load(onlyUnread);
  }, [load, onlyUnread]);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    await load(onlyUnread);
    await fetchUnread();
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    await load(onlyUnread);
    await fetchUnread();
  };

  const triggerReminder = async () => {
    setMsg('');
    setErr('');
    try {
      const r = await api.post('/jobs/pickup-reminder');
      setMsg(r.data.message);
      await load(onlyUnread);
      await fetchUnread();
    } catch (e) {
      setErr(getErrMsg(e));
    }
  };

  return (
    <div className="container page" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Thông báo hệ thống </h1>
          <p className="page-subtitle">
            Các sự kiện tự động gửi thông báo: Tạo đơn, Xác nhận, Từ chối, Huỷ, Thanh toán, Nhắc lịch nhận xe, Giao – Trả xe, Hoàn tất
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${onlyUnread ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setOnlyUnread(!onlyUnread)}
          >
            {onlyUnread ? 'Đang lọc: Chưa đọc' : 'Chỉ hiện chưa đọc'}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={markAllRead}>
            ✓ Đánh dấu tất cả đã đọc
          </button>
          {hasPerm('ORDER_PROCESS') && (
            <button type="button" className="btn btn-warning btn-sm" onClick={triggerReminder}>
              ⏰ Chạy Job nhắc lịch nhận xe (&lt; 24h)
            </button>
          )}
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          Không có thông báo nào.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((n) => {
            const tb = TYPE_BADGE[n.LoaiThongBao] || { label: n.LoaiThongBao, cls: 'badge-secondary' };
            return (
              <div
                key={n.MaThongBao}
                className="card"
                style={{
                  padding: 14,
                  background: n.DaDoc ? '#fff' : '#eff6ff',
                  borderColor: n.DaDoc ? '#e2e8f0' : '#93c5fd',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span className={`badge ${tb.cls}`}>{tb.label}</span>
                    <strong>{n.TieuDe}</strong>
                    {!n.DaDoc && <span className="badge badge-danger">Mới</span>}
                  </div>
                  <div style={{ color: '#334155', fontSize: 13.5 }}>{n.NoiDung}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {formatDateTime(n.ThoiGianTao)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {n.MaDonThue && (
                    <Link
                      to={`/orders/${n.MaDonThue}`}
                      className="btn btn-primary btn-sm"
                      onClick={() => !n.DaDoc && markRead(n.MaThongBao)}
                    >
                      Đơn #{n.MaDonThue} →
                    </Link>
                  )}
                  {!n.DaDoc && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => markRead(n.MaThongBao)}>
                      Đã đọc
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
