import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import CarDetailPage from './pages/CarDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import MyOrdersPage from './pages/MyOrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import StaffPage from './pages/StaffPage';
import AdminPage from './pages/AdminPage';
import RubricDemoPage from './pages/RubricDemoPage';

function ProtectedRoute({ children, perms }) {
  const { user, loading, hasPerm } = useAuth();
  if (loading) return <div className="container page">Đang tải phiên đăng nhập...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (perms && perms.length > 0 && !hasPerm(...perms)) {
    return (
      <div className="container page">
        <div className="alert alert-error">
          Tài khoản của bạn ({user.TenVaiTro}) không có quyền truy cập trang này (cần: {perms.join(' / ')}).
        </div>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cars/:id" element={<CarDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/rubric-demo" element={<RubricDemoPage />} />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-orders"
            element={
              <ProtectedRoute perms={['ORDER_VIEW_OWN', 'ORDER_PROCESS']}>
                <MyOrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <ProtectedRoute perms={['ORDER_VIEW_OWN', 'ORDER_PROCESS']}>
                <OrderDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute perms={['ORDER_PROCESS']}>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute perms={['CAR_MANAGE', 'USER_MANAGE', 'PERMISSION_MANAGE', 'AUDIT_VIEW', 'REPORT_VIEW']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
