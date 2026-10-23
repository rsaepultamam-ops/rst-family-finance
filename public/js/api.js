/**
 * RST Family Finance - API Client & Formatting Helpers
 */

const API = {
  TOKEN_KEY: 'rst_family_token',
  USER_KEY: 'rst_family_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setSession(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  getCurrentUser() {
    try {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers
      });

      // Handle session expiration
      if (res.status === 401) {
        this.clearSession();
        if (!window.location.pathname.endsWith('login.html')) {
          window.location.href = '/login.html';
        }
        throw new Error('Sesi Anda telah kedaluwarsa. Silakan login kembali.');
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Terjadi kesalahan pada server');
      }
      return json;
    } catch (err) {
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

/**
 * Format currency to Indonesian Rupiah
 */
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

/**
 * Format Date (e.g., 23 Okt 2026)
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

window.API = API;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
