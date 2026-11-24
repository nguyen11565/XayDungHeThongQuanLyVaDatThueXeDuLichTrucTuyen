import axios from 'axios';

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function imgUrl(path) {
  if (!path) return 'https://placehold.co/800x600/e2e8f0/475569?text=Xe+Du+Lich';
  if (path.startsWith('http')) return path;
  return `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function getErrMsg(err) {
  return err?.response?.data?.message || err?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
}

export default api;
