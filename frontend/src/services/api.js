import axios from 'axios';

// Use relative URLs so requests go through Vite proxy (works with ngrok)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401 if it's NOT a login attempt
    // Login failures should be handled by the login form, not by redirecting
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    
    if (error.response?.status === 401 && !isLoginRequest) {
      // Unauthorized on a protected route - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getCurrentUser: () => api.get('/auth/me'),
};

// Tasks API
export const tasksAPI = {
  list: (params) => api.get('/api/tasks', { params }),
  get: (id) => api.get(`/api/tasks/${id}`),
  create: (data) => api.post('/api/tasks', data),
  update: (id, data) => api.patch(`/api/tasks/${id}`, data),
  delete: (id) => api.delete(`/api/tasks/${id}`),
};

// Calendar API
export const calendarAPI = {
  getEvents: (start, end) => 
    api.get('/api/calendar', { 
      params: { 
        start: start.toISOString(), 
        end: end.toISOString() 
      } 
    }),
  getUnscheduled: () => api.get('/api/calendar/unscheduled'),
  getUnscheduledPickups: () => api.get('/api/calendar/unscheduled-pickups'),
};

// Items API
export const itemsAPI = {
  lookup: (sku) => api.get('/api/items/lookup', { params: { sku } }),
};

// Pickups API
export const pickupsAPI = {
  list: (params) => api.get('/api/pickups', { params }),
  get: (id) => api.get(`/api/pickups/${id}`),
  create: (data) => api.post('/api/pickups', data),
  update: (id, data) => api.patch(`/api/pickups/${id}`, data),
  delete: (id) => api.delete(`/api/pickups/${id}`),
  getStats: () => api.get('/api/pickups/stats'),
  complete: (id) => api.post(`/api/pickups/${id}/complete`),
};

// SMS Conversations API
export const smsAPI = {
  list: (params) => api.get('/sms/conversations', { params }),
  get: (id) => api.get(`/sms/conversations/${id}`),
  delete: (id) => api.delete(`/sms/conversations/${id}`),
  getStats: () => api.get('/sms/stats'),
};

// Uploads API
export const uploadsAPI = {
  uploadImages: (files) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return api.post('/api/uploads/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteImage: (filename) => api.delete(`/api/uploads/images/${filename}`),
};

export default api;

