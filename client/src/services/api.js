import axios from 'axios';
import useToastStore from '../store/toastStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('macan_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Callers can opt out of the global toast by setting
    // `config.suppressErrorToast = true` on their request.
    const suppress = error.config?.suppressErrorToast;

    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        // Token invalid/expired — drop it so the app redirects to /login
        localStorage.removeItem('macan_token');
      } else if (!suppress && status >= 500) {
        useToastStore
          .getState()
          .error('Something went wrong on our end. Please try again.');
      }
    } else if (error.request && !suppress) {
      // No response at all — network error
      useToastStore
        .getState()
        .error('Network error. Check your connection and try again.');
    }
    return Promise.reject(error);
  }
);

export default api;
