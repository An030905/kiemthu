
// Tự động xác định BASE URL: 
// Nếu đang chạy local (localhost) thì gọi đến port 5050
// Nếu đã deploy lên server thật thì dùng đường dẫn tương đối (vừa chạy web vừa chạy API trên cùng 1 port)
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5050/api' 
  : '/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

const handleJson = async (res: Response) => {
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const err = await res.json();
      message = err.message || message;
    } catch (e) { /* ignore */ }
    const error: any = new Error(message);
    error.code = res.status;
    throw error;
  }
  return res.json();
};

export const api = {
  auth: {
    me: async () => {
      const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: getHeaders() });
      return handleJson(res);
    },
    login: async (credentials: any) => {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      return handleJson(res);
    },
    register: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return handleJson(res);
    },
    forgotPassword: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return handleJson(res);
    },
    resetPassword: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return handleJson(res);
    }
  },
  user: {
    updateProfile: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return handleJson(res);
    }
  },
  events: {
    getAll: async () => {
      const res = await fetch(`${API_BASE_URL}/events`, { headers: getHeaders() });
      return handleJson(res);
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      const isVi = (localStorage.getItem('language') || 'vi') === 'vi';
      try {
        return await handleJson(res);
      } catch (err: any) {
        if (err.code === 401) throw err;
        const msg = err.message || (isVi ? 'Không thể tạo lịch' : 'Cannot create event');
        const e: any = new Error(msg);
        e.code = err.code;
        throw e;
      }
    },
    update: async (id: string, data: any) => {
      const res = await fetch(`${API_BASE_URL}/events/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      const isVi = (localStorage.getItem('language') || 'vi') === 'vi';
      try {
        return await handleJson(res);
      } catch (err: any) {
        if (err.code === 401) throw err;
        const msg = err.message || (isVi ? 'Không thể cập nhật lịch' : 'Cannot update event');
        const e: any = new Error(msg);
        e.code = err.code;
        throw e;
      }
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/events/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (res.status === 401) {
        const err: any = new Error('Unauthorized');
        err.code = 401;
        throw err;
      }
    }
  },
  tasks: {
    getAll: async () => {
      const res = await fetch(`${API_BASE_URL}/tasks`, { headers: getHeaders() });
      return handleJson(res);
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return handleJson(res);
    },
    update: async (id: string, data: any) => {
      const res = await fetch(`${API_BASE_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return handleJson(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/tasks/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (res.status === 401) {
        const err: any = new Error('Unauthorized');
        err.code = 401;
        throw err;
      }
    }
  },
  notes: {
    getAll: async () => {
      const res = await fetch(`${API_BASE_URL}/notes`, { headers: getHeaders() });
      return handleJson(res);
    },
    save: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/notes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return handleJson(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/notes/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (res.status === 401) {
        const err: any = new Error('Unauthorized');
        err.code = 401;
        throw err;
      }
    }
  },
  notifications: {
    getAll: async () => {
      const res = await fetch(`${API_BASE_URL}/notifications`, { headers: getHeaders() });
      return handleJson(res);
    },
    update: async (id: string, data: any) => {
      const res = await fetch(`${API_BASE_URL}/notifications/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return handleJson(res);
    }
  }
};
