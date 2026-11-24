import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import api, { imgUrl, getErrMsg } from '../api';
import { CAR_STATUS, formatDate, formatDateTime, formatVND } from '../utils/format';

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0284c7', '#64748b'];

export default function AdminPage() {
  const [tab, setTab] = useState('reports');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Reports
  const [report, setReport] = useState(null);
  const [tuNgay, setTuNgay] = useState('2026-10-01');
  const [denNgay, setDenNgay] = useState('2026-12-31');

  // Cars & Types & Fee rules
  const [cars, setCars] = useState([]);
  const [types, setTypes] = useState([]);
  const [feeRules, setFeeRules] = useState([]);
  const [editingCar, setEditingCar] = useState(null);
  const [carForm, setCarForm] = useState({
    maLoaiXe: 1,
    bienSo: '',
    tenXe: '',
    hangXe: '',
    namSanXuat: 2024,
    giaThueNgay: 900000,
    tienCoc: 2000000,
    moTa: '',
  });
  const [typeForm, setTypeForm] = useState({ tenLoai: '', soCho: 5, moTa: '' });

  // Users & Roles
  const [users, setUsers] = useState([]);
  const [rolesData, setRolesData] = useState({ vaiTro: [], quyen: [] });
  const [userForm, setUserForm] = useState({
    hoTen: '',
    email: '',
    soDienThoai: '',
    diaChi: '',
    matKhau: '123456',
    maVaiTro: 2,
  });

  // Audit logs
  const [audit, setAudit] = useState({ rows: [], total: 0, hanhDong: [], loaiDoiTuong: [] });
  const [auditFilter, setAuditFilter] = useState({ loaiDoiTuong: '', hanhDong: '', q: '' });

  const loadReports = useCallback(async () => {
    try {
      const r = await api.get('/reports/summary', { params: { tuNgay, denNgay } });
      setReport(r.data);
    } catch (e) {
      setErr(getErrMsg(e));
    }
  }, [tuNgay, denNgay]);

  const loadCars = useCallback(async () => {
    try {
      const [c, t, f] = await Promise.all([api.get('/cars'), api.get('/car-types'), api.get('/fee-rules')]);
      setCars(c.data);
      setTypes(t.data);
      setFeeRules(f.data);
    } catch (e) {
      setErr(getErrMsg(e));
    }
  }, []);

  const loadUsersAndRoles = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([api.get('/users'), api.get('/roles')]);
      setUsers(u.data);
      setRolesData(r.data);
    } catch (e) {
      setErr(getErrMsg(e));
    }
  }, []);

  const loadAudit = useCallback(async (f = auditFilter) => {
    try {
      const params = {};
      if (f.loaiDoiTuong) params.loaiDoiTuong = f.loaiDoiTuong;
      if (f.hanhDong) params.hanhDong = f.hanhDong;
      if (f.q) params.q = f.q;
      const r = await api.get('/audit-logs', { params });
      setAudit(r.data);
    } catch (e) {
      setErr(getErrMsg(e));
    }
  }, [auditFilter]);

  useEffect(() => {
    setMsg('');
    setErr('');
    if (tab === 'reports') loadReports();
    if (tab === 'cars') loadCars();
    if (tab === 'users' || tab === 'permissions') loadUsersAndRoles();
    if (tab === 'audit') loadAudit();
  }, [tab, loadReports, loadCars, loadUsersAndRoles, loadAudit]);

  const saveCar = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      if (editingCar) {
        const r = await api.put(`/cars/${editingCar.MaXe}`, carForm);
        setMsg(r.data.message);
      } else {
        const r = await api.post('/cars', carForm);
        setMsg(r.data.message);
      }
      setEditingCar(null);
      setCarForm({ maLoaiXe: types[0]?.MaLoaiXe || 1, bienSo: '', tenXe: '', hangXe: '', namSanXuat: 2024, giaThueNgay: 900000, tienCoc: 2000000, moTa: '' });
      loadCars();
    } catch (e2) {
      setErr(getErrMsg(e2));
    }
  };

  const changeCarStatus = async (maXe, trangThai) => {
    setMsg('');
    setErr('');
    try {
      const r = await api.patch(`/cars/${maXe}/status`, { trangThai });
      setMsg(r.data.message);
      loadCars();
    } catch (e) {
      setErr(getErrMsg(e));
    }
  };

  const addCarType = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      const r = await api.post('/car-types', typeForm);
      setMsg(r.data.message);
      setTypeForm({ tenLoai: '', soCho: 5, moTa: '' });
      loadCars();
    } catch (e2) {
      setErr(getErrMsg(e2));
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      const r = await api.post('/users', userForm);
      setMsg(r.data.message);
      setUserForm({ hoTen: '', email: '', soDienThoai: '', diaChi: '', matKhau: '123456', maVaiTro: 2 });
      loadUsersAndRoles();
    } catch (e2) {
      setErr(getErrMsg(e2));
    }
  };

  const toggleUserLock = async (u) => {
    setMsg('');
    setErr('');
    try {
      const next = u.TrangThai === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
      const r = await api.patch(`/users/${u.MaNguoiDung}/status`, { trangThai: next });
      setMsg(r.data.message);
      loadUsersAndRoles();
    } catch (e) {
      setErr(getErrMsg(e));
    }
  };

  const changeUserRole = async (maNguoiDung, maVaiTro) => {
    setMsg('');
    setErr('');
    try {
      const r = await api.patch(`/users/${maNguoiDung}/role`, { maVaiTro: Number(maVaiTro) });
      setMsg(r.data.message);
      loadUsersAndRoles();
    } catch (e) {
      setErr(getErrMsg(e));
    }
  };

  const togglePermission = async (role, maQuyen) => {
    setMsg('');
    setErr('');
    const current = role.quyen || [];
    const next = current.includes(maQuyen) ? current.filter((x) => x !== maQuyen) : [...current, maQuyen];
    try {
      const r = await api.put(`/roles/${role.MaVaiTro}/permissions`, { maQuyen: next });
      setMsg(r.data.message);
      loadUsersAndRoles();
    } catch (e) {
      setErr(getErrMsg(e));
    }
  };

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản trị Hệ thống & Thống kê Báo cáo </h1>
          <p className="page-subtitle">
            Quản lý đội xe, người dùng, ma trận phân quyền RBAC, nhật ký thay đổi Audit Log và báo cáo doanh thu
          </p>
        </div>
      </div>

      <div className="tabs">
        <button type="button" className={`tab-btn ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
          Thống kê & Báo cáo 
        </button>
        <button type="button" className={`tab-btn ${tab === 'cars' ? 'active' : ''}`} onClick={() => setTab('cars')}>
          Quản lý Xe & Quy tắc phí 
        </button>
        <button type="button" className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          Quản lý Người dùng 
        </button>
        <button type="button" className={`tab-btn ${tab === 'permissions' ? 'active' : ''}`} onClick={() => setTab('permissions')}>
          Ma trận Phân quyền 
        </button>
        <button type="button" className={`tab-btn ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
          Nhật ký Audit Log 
        </button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      {/* TAB 1: BÁO CÁO (UC22) */}
      {tab === 'reports' && report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Từ ngày</label>
                <input type="date" className="input" value={tuNgay} onChange={(e) => setTuNgay(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Đến ngày</label>
                <input type="date" className="input" value={denNgay} onChange={(e) => setDenNgay(e.target.value)} />
              </div>
              <button type="button" className="btn btn-primary" onClick={loadReports}>
                Thống kê dữ liệu
              </button>
            </div>
          </div>

          <div className="grid-3">
            <div className="stat-card" style={{ borderLeft: '4px solid #059669' }}>
              <div className="stat-label">Doanh thu thuần (đã trừ hoàn tiền)</div>
              <div className="stat-value" style={{ color: '#059669' }}>
                {formatVND(report.tongQuan?.DoanhThuThuan)}
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
              <div className="stat-label">Tổng tiền đã hoàn trả khách</div>
              <div className="stat-value">{formatVND(report.tongQuan?.HoanTien)}</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
              <div className="stat-label">Số giao dịch thành công</div>
              <div className="stat-value">{report.tongQuan?.SoGiaoDich || 0} giao dịch</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-title">Biểu đồ Doanh thu theo ngày</div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={(report.doanhThuTheoNgay || []).map((d) => ({
                      ngay: formatDate(d.Ngay),
                      DoanhThu: Number(d.DoanhThu),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ngay" />
                    <YAxis />
                    <Tooltip formatter={(v) => formatVND(v)} />
                    <Bar dataKey="DoanhThu" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Tỷ lệ Đơn thuê theo Trạng thái</div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={(report.donTheoTrangThai || []).map((x) => ({
                        name: x.TrangThai,
                        value: Number(x.SoLuong),
                      }))}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={95}
                      label
                    >
                      {(report.donTheoTrangThai || []).map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Hiệu suất khai thác đội xe</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Xe & Biển số</th>
                    <th>Trạng thái hiện tại</th>
                    <th>Tổng số đơn</th>
                    <th>Đơn hoàn tất</th>
                    <th>Số ngày khai thác</th>
                    <th style={{ textAlign: 'right' }}>Doanh thu hoàn tất</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.hieuSuatXe || []).map((x) => {
                    const st = CAR_STATUS[x.TrangThai] || { label: x.TrangThai, badge: 'badge-secondary' };
                    return (
                      <tr key={x.MaXe}>
                        <td>
                          <strong>{x.TenXe}</strong> ({x.BienSo})
                        </td>
                        <td>
                          <span className={`badge ${st.badge}`}>{st.label}</span>
                        </td>
                        <td>{x.SoDon}</td>
                        <td>{x.SoDonHoanTat}</td>
                        <td>{x.SoNgayKhaiThac} ngày</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                          {formatVND(x.DoanhThu)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUẢN LÝ XE & LOẠI XE & QUY TẮC PHÍ */}
      {tab === 'cars' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="grid-2">
            <div className="card">
              <div className="card-title">{editingCar ? `Cập nhật xe #${editingCar.MaXe}` : 'Thêm xe mới '}</div>
              <form onSubmit={saveCar}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Loại xe *</label>
                    <select
                      className="select"
                      value={carForm.maLoaiXe}
                      onChange={(e) => setCarForm({ ...carForm, maLoaiXe: Number(e.target.value) })}
                    >
                      {types.map((t) => (
                        <option key={t.MaLoaiXe} value={t.MaLoaiXe}>
                          {t.TenLoai} ({t.SoCho} chỗ)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Biển số (duy nhất) *</label>
                    <input
                      className="input"
                      value={carForm.bienSo}
                      onChange={(e) => setCarForm({ ...carForm, bienSo: e.target.value })}
                      placeholder="51A-888.88"
                      required
                    />
                  </div>
                </div>
                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Tên xe *</label>
                    <input
                      className="input"
                      value={carForm.tenXe}
                      onChange={(e) => setCarForm({ ...carForm, tenXe: e.target.value })}
                      placeholder="Mazda CX-5"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hãng xe</label>
                    <input
                      className="input"
                      value={carForm.hangXe}
                      onChange={(e) => setCarForm({ ...carForm, hangXe: e.target.value })}
                      placeholder="Mazda"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Năm SX</label>
                    <input
                      type="number"
                      className="input"
                      value={carForm.namSanXuat}
                      onChange={(e) => setCarForm({ ...carForm, namSanXuat: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Giá thuê / ngày (VNĐ) *</label>
                    <input
                      type="number"
                      className="input"
                      value={carForm.giaThueNgay}
                      onChange={(e) => setCarForm({ ...carForm, giaThueNgay: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tiền cọc chuẩn (VNĐ) *</label>
                    <input
                      type="number"
                      className="input"
                      value={carForm.tienCoc}
                      onChange={(e) => setCarForm({ ...carForm, tienCoc: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Mô tả</label>
                  <input
                    className="input"
                    value={carForm.moTa}
                    onChange={(e) => setCarForm({ ...carForm, moTa: e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary">
                    {editingCar ? 'Lưu cập nhật xe' : '+ Thêm xe'}
                  </button>
                  {editingCar && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setEditingCar(null);
                        setCarForm({ maLoaiXe: types[0]?.MaLoaiXe || 1, bienSo: '', tenXe: '', hangXe: '', namSanXuat: 2024, giaThueNgay: 900000, tienCoc: 2000000, moTa: '' });
                      }}
                    >
                      Huỷ sửa
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="card">
              <div className="card-title">Loại xe & Quy tắc tính phụ phí</div>
              <form onSubmit={addCarType} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input
                  className="input"
                  placeholder="Tên loại xe mới..."
                  value={typeForm.tenLoai}
                  onChange={(e) => setTypeForm({ ...typeForm, tenLoai: e.target.value })}
                  required
                />
                <input
                  type="number"
                  className="input"
                  style={{ width: 90 }}
                  value={typeForm.soCho}
                  onChange={(e) => setTypeForm({ ...typeForm, soCho: e.target.value })}
                  required
                />
                <button type="submit" className="btn btn-outline">
                  + Loại xe
                </button>
              </form>

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Quy tắc phí đang cấu hình:</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Loại phí</th>
                    <th>Tên quy tắc</th>
                    <th>Kiểu</th>
                    <th>Giá trị</th>
                  </tr>
                </thead>
                <tbody>
                  {feeRules.map((f) => (
                    <tr key={f.MaQuyTac}>
                      <td>
                        <code>{f.LoaiPhi}</code>
                      </td>
                      <td>{f.TenQuyTac}</td>
                      <td>{f.KieuTinh}</td>
                      <td style={{ fontWeight: 700 }}>
                        {f.KieuTinh === 'PERCENT' ? `${f.GiaTri}%` : formatVND(f.GiaTri)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Danh sách đội xe ({cars.length} xe)</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ảnh</th>
                    <th>Biển số & Tên xe</th>
                    <th>Loại</th>
                    <th>Giá / Ngày</th>
                    <th>Tiền cọc</th>
                    <th>Trạng thái</th>
                    <th>Đổi trạng thái / Sửa</th>
                  </tr>
                </thead>
                <tbody>
                  {cars.map((c) => {
                    const st = CAR_STATUS[c.TrangThai] || { label: c.TrangThai, badge: 'badge-secondary' };
                    return (
                      <tr key={c.MaXe}>
                        <td>
                          <img
                            src={imgUrl(c.AnhDaiDien)}
                            alt={c.TenXe}
                            style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 6 }}
                          />
                        </td>
                        <td>
                          <strong>{c.TenXe}</strong>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {c.BienSo} • {c.HangXe} ({c.NamSanXuat})
                          </div>
                        </td>
                        <td>
                          {c.TenLoai} ({c.SoCho} chỗ)
                        </td>
                        <td style={{ fontWeight: 700, color: '#2563eb' }}>{formatVND(c.GiaThueNgay)}</td>
                        <td>{formatVND(c.TienCoc)}</td>
                        <td>
                          <span className={`badge ${st.badge}`}>{st.label}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                setEditingCar(c);
                                setCarForm({
                                  maLoaiXe: c.MaLoaiXe,
                                  bienSo: c.BienSo,
                                  tenXe: c.TenXe,
                                  hangXe: c.HangXe || '',
                                  namSanXuat: c.NamSanXuat || 2024,
                                  giaThueNgay: c.GiaThueNgay,
                                  tienCoc: c.TienCoc,
                                  moTa: c.MoTa || '',
                                });
                              }}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => changeCarStatus(c.MaXe, 'AVAILABLE')}
                            >
                              Trống
                            </button>
                            <button
                              type="button"
                              className="btn btn-warning btn-sm"
                              onClick={() => changeCarStatus(c.MaXe, 'MAINTENANCE')}
                            >
                              Bảo trì
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => changeCarStatus(c.MaXe, 'INACTIVE')}
                            >
                              Ngưng
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QUẢN LÝ NGƯỜI DÙNG */}
      {tab === 'users' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title">Tạo tài khoản Nhân viên / Người dùng mới </div>
            <form onSubmit={createUser}>
              <div className="form-group">
                <label className="form-label">Họ và tên *</label>
                <input
                  className="input"
                  value={userForm.hoTen}
                  onChange={(e) => setUserForm({ ...userForm, hoTen: e.target.value })}
                  required
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="input"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Số điện thoại</label>
                  <input
                    className="input"
                    value={userForm.soDienThoai}
                    onChange={(e) => setUserForm({ ...userForm, soDienThoai: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Vai trò *</label>
                  <select
                    className="select"
                    value={userForm.maVaiTro}
                    onChange={(e) => setUserForm({ ...userForm, maVaiTro: Number(e.target.value) })}
                  >
                    {rolesData.vaiTro.map((r) => (
                      <option key={r.MaVaiTro} value={r.MaVaiTro}>
                        {r.MoTa} ({r.TenVaiTro})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Mật khẩu khởi tạo *</label>
                  <input
                    type="text"
                    className="input"
                    value={userForm.matKhau}
                    onChange={(e) => setUserForm({ ...userForm, matKhau: e.target.value })}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                + Tạo tài khoản
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">Danh sách tài khoản ({users.length})</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Họ tên & Email</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.MaNguoiDung}>
                      <td>
                        <strong>{u.HoTen}</strong>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {u.Email} • {u.SoDienThoai || '—'}
                        </div>
                      </td>
                      <td>
                        <select
                          className="select"
                          style={{ padding: '4px 8px', fontSize: 12.5 }}
                          value={u.MaVaiTro}
                          onChange={(e) => changeUserRole(u.MaNguoiDung, e.target.value)}
                        >
                          {rolesData.vaiTro.map((r) => (
                            <option key={r.MaVaiTro} value={r.MaVaiTro}>
                              {r.TenVaiTro}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${u.TrangThai === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                          {u.TrangThai}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`btn btn-sm ${u.TrangThai === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggleUserLock(u)}
                        >
                          {u.TrangThai === 'ACTIVE' ? 'Khoá' : 'Mở khoá'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MA TRẬN PHÂN QUYỀN  */}
      {tab === 'permissions' && (
        <div className="card">
          <div className="card-title">Ma trận Phân quyền Vai trò × Quyền hạn </div>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            Tích hoặc bỏ tích để cấp / thu hồi quyền trực tiếp cho từng vai trò (mọi thay đổi có hiệu lực tức thì và được ghi vào AuditLog).
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã quyền</th>
                  <th>Mô tả nghiệp vụ</th>
                  {rolesData.vaiTro.map((r) => (
                    <th key={r.MaVaiTro} style={{ textAlign: 'center' }}>
                      {r.MoTa} ({r.TenVaiTro})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rolesData.quyen.map((q) => (
                  <tr key={q.MaQuyen}>
                    <td>
                      <code>{q.TenQuyen}</code>
                    </td>
                    <td>{q.MoTa}</td>
                    {rolesData.vaiTro.map((r) => {
                      const checked = (r.quyen || []).includes(q.MaQuyen);
                      return (
                        <td key={r.MaVaiTro} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(r, q.MaQuyen)}
                            style={{ width: 17, height: 17, cursor: 'pointer' }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOG (UC21) */}
      {tab === 'audit' && (
        <div className="card">
          <div className="card-title">Nhật ký Lịch sử thay đổi Hệ thống - Audit Log </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <select
              className="select"
              style={{ width: 180 }}
              value={auditFilter.loaiDoiTuong}
              onChange={(e) => {
                const nf = { ...auditFilter, loaiDoiTuong: e.target.value };
                setAuditFilter(nf);
                loadAudit(nf);
              }}
            >
              <option value="">-- Mọi đối tượng --</option>
              {(audit.loaiDoiTuong || []).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              className="select"
              style={{ width: 180 }}
              value={auditFilter.hanhDong}
              onChange={(e) => {
                const nf = { ...auditFilter, hanhDong: e.target.value };
                setAuditFilter(nf);
                loadAudit(nf);
              }}
            >
              <option value="">-- Mọi hành động --</option>
              {(audit.hanhDong || []).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <input
              className="input"
              style={{ width: 240 }}
              placeholder="Tìm người thao tác, nội dung..."
              value={auditFilter.q}
              onChange={(e) => setAuditFilter({ ...auditFilter, q: e.target.value })}
            />
            <button type="button" className="btn btn-primary" onClick={() => loadAudit(auditFilter)}>
              Lọc Audit Log
            </button>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Đối tượng</th>
                  <th>Hành động</th>
                  <th>Giá trị cũ → Giá trị mới</th>
                </tr>
              </thead>
              <tbody>
                {(audit.rows || []).map((a) => (
                  <tr key={a.MaLog}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{formatDateTime(a.ThoiGian)}</td>
                    <td>
                      <strong>{a.HoTen || 'Hệ thống'}</strong>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{a.TenVaiTro || ''}</div>
                    </td>
                    <td>
                      <span className="badge badge-secondary">{a.LoaiDoiTuong}</span> #{a.MaDoiTuong}
                    </td>
                    <td>
                      <span className="badge badge-info">{a.HanhDong}</span>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 420, wordBreak: 'break-all' }}>
                      {a.GiaTriCu && <span style={{ color: '#dc2626' }}>{a.GiaTriCu} → </span>}
                      <span style={{ color: '#059669' }}>{a.GiaTriMoi || '—'}</span>
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
