import axios from 'axios';

const api = axios.create({
  // Relative by default so the production build talks to whatever origin serves
  // it (Nginx proxies /api → backend) and dev goes through the Vite proxy.
  // Set VITE_API_URL to point at a backend on another origin.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach Authorization token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('crm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Track if we're already handling a 401 to prevent redirect loops
let isRedirecting = false;

// Response interceptor — handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Only redirect once, not on every failed request
      if (!isRedirecting && window.location.pathname !== '/login') {
        isRedirecting = true;
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        // Use a small delay to batch multiple 401s from parallel requests
        setTimeout(() => {
          window.location.href = '/login';
          // Reset flag after redirect starts
          setTimeout(() => { isRedirecting = false; }, 2000);
        }, 100);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
