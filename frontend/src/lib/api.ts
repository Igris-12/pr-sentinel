import axios from 'axios';
import { useAuthStore } from '../store';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('prsentinel_token') || useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Sync to local storage if it was missing
    if (!localStorage.getItem('prsentinel_token')) {
      localStorage.setItem('prsentinel_token', token);
    }
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        localStorage.setItem('prsentinel_token', data.accessToken);
        useAuthStore.getState().setAuth(useAuthStore.getState().user as any, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('prsentinel_token');
        useAuthStore.getState().clearAuth();
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
