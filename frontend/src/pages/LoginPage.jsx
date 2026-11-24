import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrMsg } from '../api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [matKhau, setMatKhau] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const doLogin = async (eMail, pw) => {
    setErr('');
    setLoading(true);

    try {
      const u = await login(eMail, pw);

      const from = location.state?.from;

      if (from) {
        navigate(from);
      } else if (u.TenVaiTro === 'ADMIN') {
        navigate('/admin');
      } else if (u.TenVaiTro === 'EMPLOYEE') {
        navigate('/staff');
      } else {
        navigate('/');
      }
    } catch (e) {
      setErr(getErrMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    doLogin(email, matKhau);
  };

  return (
    <div
      className="container page"
      style={{
        maxWidth: 650,
        margin: '0 auto',
      }}
    >
      <div className="card">
        <h1
          className="page-title"
          style={{ marginBottom: 4 }}
        >
          Đăng nhập hệ thống
        </h1>

        <p
          className="page-subtitle"
          style={{ marginBottom: 16 }}
        >
          Nhập tài khoản để đặt xe hoặc vận hành hệ thống
        </p>

        {err && (
          <div className="alert alert-error">
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Email
            </label>

            <input
              type="email"
              className="input"
              placeholder="Nhập email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Mật khẩu
            </label>

            <input
              type="password"
              className="input"
              placeholder="Nhập mật khẩu"
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{
              width: '100%',
              marginTop: 8,
            }}
            disabled={loading}
          >
            {loading
              ? 'Đang xác thực...'
              : 'Đăng nhập'}
          </button>
        </form>

        <div
          style={{
            marginTop: 14,
            fontSize: 13.5,
            color: '#64748b',
            textAlign: 'center',
          }}
        >
          Chưa có tài khoản khách hàng?{' '}
          <Link
            to="/register"
            style={{
              color: '#2563eb',
              fontWeight: 600,
            }}
          >
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </div>
  );
}