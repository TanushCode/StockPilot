/**
 * StockPilot — API client with JWT auth.
 */
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('stockpilot_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem('stockpilot_token');
    localStorage.removeItem('stockpilot_user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

const api = {
  // Auth
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request('/auth/me'),
  changePassword: (old_password, new_password) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password, new_password }),
    }),

  // Dashboard
  dashboard: () => request('/inventory/dashboard'),

  // Products
  getProducts: (params = '') => request(`/products${params ? '?' + params : ''}`),
  getProduct: (id) => request(`/products/${id}`),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  getCategories: () => request('/products/categories'),

  // Suppliers
  getSuppliers: () => request('/suppliers'),
  getSupplier: (id) => request(`/suppliers/${id}`),
  createSupplier: (data) => request('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id, data) => request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id) => request(`/suppliers/${id}`, { method: 'DELETE' }),

  // Inventory Operations
  receiveStock: (data) => request('/inventory/receive', { method: 'POST', body: JSON.stringify(data) }),
  deductStock: (data) => request('/inventory/deduct', { method: 'POST', body: JSON.stringify(data) }),
  adjustStock: (data) => request('/inventory/adjust', { method: 'POST', body: JSON.stringify(data) }),
  writeOff: (batchId, reason) =>
    request(`/inventory/write-off/${batchId}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Batches & Movements
  getBatches: (params = '') => request(`/inventory/batches${params ? '?' + params : ''}`),
  getMovements: (params = '') => request(`/inventory/movements${params ? '?' + params : ''}`),

  // Alerts
  getAlerts: (params = '') => request(`/inventory/alerts${params ? '?' + params : ''}`),
  markAlertRead: (id) => request(`/inventory/alerts/${id}/read`, { method: 'POST' }),
  markAllAlertsRead: () => request('/inventory/alerts/read-all', { method: 'POST' }),

  // Monitoring
  getLowStock: () => request('/inventory/low-stock'),
  getExpiring: (days = 30) => request(`/inventory/expiring?days=${days}`),
  getExpired: () => request('/inventory/expired'),
  getReorder: () => request('/inventory/reorder'),

  // Files
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/files/upload', { method: 'POST', body: formData });
  },
  getInvoices: () => request('/files/invoices'),
  downloadInvoice: (id) => request(`/files/invoices/${id}/download`),
  exportInventory: () => request('/files/export/inventory'),
  exportMovements: () => request('/files/export/movements'),

  // Health
  health: () => request('/health'),
};

export default api;
