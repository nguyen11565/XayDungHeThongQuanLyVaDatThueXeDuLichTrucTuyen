import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, hasPerm, unreadCount } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-badge">🚗</span>
          <div>
            <div>NguyenCAR</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>
              Quản lý & Đặt thuê xe du lịch trực tuyến
            </div>
          </div>
        </Link>

        <nav className="nav-links">
          <NavLink to="/" end className="nav-link">
            Tìm & Đặt xe
          </NavLink>

          {user && hasPerm('ORDER_VIEW_OWN') && !hasPerm('ORDER_PROCESS') && (
            <NavLink to="/my-orders" className="nav-link">
              Đơn thuê của tôi
            </NavLink>
          )}

          {user && hasPerm('ORDER_PROCESS') && (
            <NavLink to="/staff" className="nav-link">
              Vận hành thuê xe
            </NavLink>
          )}

          {user && hasPerm('CAR_MANAGE', 'USER_MANAGE', 'PERMISSION_MANAGE', 'AUDIT_VIEW', 'REPORT_VIEW') && (
            <NavLink to="/admin" className="nav-link">
              Quản trị & Báo cáo
            </NavLink>
          )}

          {user && (
            <NavLink to="/notifications" className="nav-link">
              🔔 Thông báo
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </NavLink>
          )}
        </nav>

        <div className="nav-user">
          {user ? (
            <>
              <Link to="/profile" className="btn btn-outline btn-sm">
                👤 {user.HoTen} <span className="badge badge-primary">{user.TenVaiTro}</span>
              </Link>
              <button onClick={handleLogout} className="btn btn-outline btn-sm">
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">
                Đăng nhập
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
