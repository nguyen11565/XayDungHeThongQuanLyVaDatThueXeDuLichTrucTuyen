import React, { useState } from 'react';
import api, { getErrMsg } from '../api';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    hoTen: user?.HoTen || '',
    soDienThoai: user?.SoDienThoai || '',
    diaChi: user?.DiaChi || '',
  });
  const [pw, setPw] = useState({ matKhauCu: '', matKhauMoi: '', xacNhan: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  if (!user) return null;

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      const r = await api.put('/auth/profile', form);
      setMsg(r.data.message);
      await refreshUser();
    } catch (error) {
      setErr(getErrMsg(error));
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    if (pw.matKhauMoi !== pw.xacNhan) {
      setErr('Mật khẩu mới xác nhận không khớp.');
      return;
    }
    try {
      const r = await api.put('/auth/password', pw);
      setMsg(r.data.message);
      setPw({ matKhauCu: '', matKhauMoi: '', xacNhan: '' });
    } catch (error) {
      setErr(getErrMsg(error));
    }
  };

  return (
    <div className="container page" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hồ sơ cá nhân & Quyền hạn</h1>
          <p className="page-subtitle">UC03 - Xem thông tin tài khoản, quyền được cấp và cập nhật hồ sơ</p>
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Thông tin cá nhân</div>
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label className="form-label">Email (không thay đổi)</label>
              <input className="input" value={user.Email} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Vai trò</label>
              <input className="input" value={`${user.TenVaiTroHienThi} (${user.TenVaiTro})`} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Họ và tên *</label>
              <input
                className="input"
                value={form.hoTen}
                onChange={(e) => setForm({ ...form, hoTen: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Số điện thoại *</label>
              <input
                className="input"
                value={form.soDienThoai}
                onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Địa chỉ</label>
              <input
                className="input"
                value={form.diaChi}
                onChange={(e) => setForm({ ...form, diaChi: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Lưu thay đổi
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <div className="card-title">Đổi mật khẩu</div>
            <form onSubmit={changePassword}>
              <div className="form-group">
                <label className="form-label">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  className="input"
                  value={pw.matKhauCu}
                  onChange={(e) => setPw({ ...pw, matKhauCu: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mật khẩu mới (&gt;= 6 ký tự)</label>
                <input
                  type="password"
                  className="input"
                  value={pw.matKhauMoi}
                  onChange={(e) => setPw({ ...pw, matKhauMoi: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  className="input"
                  value={pw.xacNhan}
                  onChange={(e) => setPw({ ...pw, xacNhan: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn btn-outline">
                Đổi mật khẩu
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">Quyền hiện có ({user.permissions?.length || 0} quyền)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(user.permissions || []).map((p) => (
                <span key={p} className="badge badge-info">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
