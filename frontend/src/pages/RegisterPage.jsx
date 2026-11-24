import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrMsg } from '../api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    hoTen: '',
    email: '',
    soDienThoai: '',
    diaChi: '',
    matKhau: '',
    xacNhanMatKhau: '',
  });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (form.matKhau !== form.xacNhanMatKhau) {
      setErr('Mật khẩu xác nhận không khớp.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      setOk('Đăng ký tài khoản thành công! Đang chuyển sang trang đăng nhập...');
      setTimeout(() => navigate('/login'), 1200);
    } catch (error) {
      setErr(getErrMsg(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page" style={{ maxWidth: 520 }}>
      <div className="card">
        <h1 className="page-title" style={{ marginBottom: 4 }}>Đăng ký tài khoản Khách hàng</h1>
        <p className="page-subtitle" style={{ marginBottom: 16 }}>
          UC01 - Tạo tài khoản để đặt thuê xe trực tuyến và theo dõi hợp đồng
        </p>

        {err && <div className="alert alert-error">{err}</div>}
        {ok && <div className="alert alert-success">{ok}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Họ và tên *</label>
            <input
              className="input"
              value={form.hoTen}
              onChange={(e) => setForm({ ...form, hoTen: e.target.value })}
              placeholder="Nguyễn Văn A"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@domain.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Số điện thoại (10-11 số) *</label>
            <input
              className="input"
              value={form.soDienThoai}
              onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })}
              placeholder="0901234567"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Địa chỉ</label>
            <input
              className="input"
              value={form.diaChi}
              onChange={(e) => setForm({ ...form, diaChi: e.target.value })}
              placeholder="TP. Hồ Chí Minh"
            />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Mật khẩu (&gt;= 6 ký tự) *</label>
              <input
                type="password"
                className="input"
                value={form.matKhau}
                onChange={(e) => setForm({ ...form, matKhau: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nhập lại mật khẩu *</label>
              <input
                type="password"
                className="input"
                value={form.xacNhanMatKhau}
                onChange={(e) => setForm({ ...form, xacNhanMatKhau: e.target.value })}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Đăng ký tài khoản'}
          </button>
        </form>

        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 13.5 }}>
          Đã có tài khoản?{' '}
          <Link to="/login" style={{ color: '#2563eb', fontWeight: 600 }}>
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
