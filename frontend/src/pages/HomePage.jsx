import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { imgUrl, getErrMsg } from '../api';
import { CAR_STATUS, formatVND } from '../utils/format';

export default function HomePage() {
  const [cars, setCars] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [filters, setFilters] = useState({
    q: '',
    maLoaiXe: '',
    soCho: '',
    giaMax: '',
    tuNgay: '',
    denNgay: '',
    sapXep: '',
  });

  const loadData = useCallback(async (f) => {
    setLoading(true);
    setErr('');
    try {
      const params = {};
      Object.entries(f).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) params[k] = v;
      });
      const [carRes, typeRes] = await Promise.all([
        api.get('/cars', { params }),
        api.get('/car-types'),
      ]);
      setCars(carRes.data);
      setTypes(typeRes.data);
    } catch (e) {
      setErr(getErrMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadData(filters);
  };

  const resetFilters = () => {
    const empty = { q: '', maLoaiXe: '', soCho: '', giaMax: '', tuNgay: '', denNgay: '', sapXep: '' };
    setFilters(empty);
    loadData(empty);
  };

  return (
    <div className="container page">
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          color: '#fff',
          marginBottom: 20,
          padding: '26px 28px',
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>
          Hệ thống Quản lý và Đặt thuê Xe Du lịch Trực tuyến
        </h1>
        <p style={{ opacity: 0.92, maxWidth: 820, fontSize: 14.5 }}>
          Chọn xe 5 - 16 chỗ, kiểm tra lịch trống theo thời gian thực (chống trùng lịch & đặt đồng thời),
          ký hợp đồng điện tử, thanh toán cọc qua cổng Sandbox và theo dõi quy trình Giao - Nhận trả xe minh bạch.
        </p>
      </div>

      {/* Bộ lọc tìm kiếm */}
      <form className="card" onSubmit={handleSearch} style={{ marginBottom: 22 }}>
        <div className="card-title">
          <span> Tìm kiếm & Lọc xe khả dụng theo khoảng thời gian </span>
          <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
            Xoá bộ lọc
          </button>
        </div>

        <div className="grid-4">
          <div className="form-group">
            <label className="form-label">Từ khoá (tên xe, hãng, biển số)</label>
            <input
              className="input"
              placeholder="VD: Vios, Fortuner, 51A..."
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Loại xe</label>
            <select
              className="select"
              value={filters.maLoaiXe}
              onChange={(e) => setFilters({ ...filters, maLoaiXe: e.target.value })}
            >
              <option value="">-- Tất cả loại xe --</option>
              {types.map((t) => (
                <option key={t.MaLoaiXe} value={t.MaLoaiXe}>
                  {t.TenLoai} ({t.SoCho} chỗ)
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Giá thuê tối đa / ngày</label>
            <select
              className="select"
              value={filters.giaMax}
              onChange={(e) => setFilters({ ...filters, giaMax: e.target.value })}
            >
              <option value="">-- Mọi mức giá --</option>
              <option value="1000000">Dưới 1.000.000 đ/ngày</option>
              <option value="1800000">Dưới 1.800.000 đ/ngày</option>
              <option value="3000000">Dưới 3.000.000 đ/ngày</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Sắp xếp</label>
            <select
              className="select"
              value={filters.sapXep}
              onChange={(e) => setFilters({ ...filters, sapXep: e.target.value })}
            >
              <option value="">Mặc định</option>
              <option value="gia_tang">Giá tăng dần</option>
              <option value="gia_giam">Giá giảm dần</option>
              <option value="moi">Đời xe mới nhất</option>
            </select>
          </div>
        </div>

        <div className="grid-3" style={{ alignItems: 'end', marginTop: 4 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Ngày giờ nhận xe dự kiến</label>
            <input
              type="datetime-local"
              className="input"
              value={filters.tuNgay}
              onChange={(e) => setFilters({ ...filters, tuNgay: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Ngày giờ trả xe dự kiến</label>
            <input
              type="datetime-local"
              className="input"
              value={filters.denNgay}
              onChange={(e) => setFilters({ ...filters, denNgay: e.target.value })}
            />
          </div>
          <div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              Lọc danh sách xe ({cars.length})
            </button>
          </div>
        </div>
      </form>

      {err && <div className="alert alert-error">{err}</div>}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          Đang tải danh sách xe...
        </div>
      ) : cars.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          Không tìm thấy xe phù hợp với tiêu chí lọc.
        </div>
      ) : (
        <div className="grid-4">
          {cars.map((car) => {
            const st = CAR_STATUS[car.TrangThai] || { label: car.TrangThai, badge: 'badge-secondary' };
            const queryDate =
              filters.tuNgay && filters.denNgay
                ? `?tuNgay=${encodeURIComponent(filters.tuNgay)}&denNgay=${encodeURIComponent(filters.denNgay)}`
                : '';
            return (
              <div key={car.MaXe} className="car-card">
                <div className="car-thumb-wrap">
                  <img src={imgUrl(car.AnhDaiDien)} alt={car.TenXe} className="car-thumb" />
                  <span
                    className={`badge ${st.badge}`}
                    style={{ position: 'absolute', top: 10, right: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
                  >
                    {st.label}
                  </span>
                </div>
                <div className="car-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-secondary">{car.TenLoai}</span>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{car.BienSo}</span>
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 800 }}>{car.TenXe}</h3>
                  <div style={{ fontSize: 12.5, color: '#64748b' }}>
                    Hãng: <strong>{car.HangXe || '—'}</strong> • Đời: <strong>{car.NamSanXuat || '—'}</strong> •{' '}
                    <strong>{car.SoCho} chỗ</strong>
                  </div>
                  <p style={{ fontSize: 12.5, color: '#475569', flex: 1 }}>
                    {car.MoTa || 'Xe du lịch bảo dưỡng định kỳ, bảo hiểm đầy đủ.'}
                  </p>
                  <div
                    style={{
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: 10,
                      marginTop: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div className="car-price">{formatVND(car.GiaThueNgay)}/ngày</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>Cọc: {formatVND(car.TienCoc)}</div>
                    </div>
                    <Link to={`/cars/${car.MaXe}${queryDate}`} className="btn btn-primary btn-sm">
                      Xem & Đặt xe →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
