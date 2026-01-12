
// Tự động xác định BASE URL: 
// Nếu đang chạy local (localhost) thì gọi đến port 5000
// Nếu đã deploy lên server thật thì dùng đường dẫn tương đối (vừa chạy web vừa chạy API trên cùng 1 port)
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : '/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

export const api = {
  auth: {
    login: async (credentials: any) => {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Login failed');
      }
      return res.json();
    },
    register: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Registration failed');
      }
      return res.json();
    }
  },
  user: {
    updateProfile: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return res.json();
    }
  },
  events: {
    getAll: async () => {
      const res = await fetch(`${API_BASE_URL}/events`, { headers: getHeaders() });
      return res.json();
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return res.json();
    },
    delete: async (id: string) => {
      await fetch(`${API_BASE_URL}/events/${id}`, { method: 'DELETE', headers: getHeaders() });
    }
  },
  tasks: {
    getAll: async () => {
      const res = await fetch(`${API_BASE_URL}/tasks`, { headers: getHeaders() });
      return res.json();
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return res.json();
    },
    update: async (id: string, data: any) => {
      const res = await fetch(`${API_BASE_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return res.json();
    },
    delete: async (id: string) => {
      await fetch(`${API_BASE_URL}/tasks/${id}`, { method: 'DELETE', headers: getHeaders() });
    }
  },
  notes: {
    getAll: async () => {
      const res = await fetch(`${API_BASE_URL}/notes`, { headers: getHeaders() });
      return res.json();
    },
    save: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/notes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return res.json();
    }
  }
};
