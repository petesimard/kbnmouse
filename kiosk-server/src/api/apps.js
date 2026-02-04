const TOKEN_KEY = 'adminToken';

const getToken = () => localStorage.getItem(TOKEN_KEY);

const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const headers = () => ({
  'Content-Type': 'application/json',
  'X-Admin-Token': getToken(),
});

// Custom error for unauthorized requests
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

// Helper to handle responses and detect 401
async function handleResponse(res) {
  if (res.status === 401) {
    clearToken();
    throw new UnauthorizedError();
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Request failed');
  }
  // Handle 204 No Content
  if (res.status === 204) {
    return null;
  }
  return res.json();
}

export async function verifyPin(pin) {
  const res = await fetch('/api/admin/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Invalid PIN');
  }
  return res.json();
}

export async function changePin(currentPin, newPin) {
  const res = await fetch('/api/admin/change-pin', {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ currentPin, newPin }),
  });
  return handleResponse(res);
}

export async function fetchAllApps() {
  const res = await fetch('/api/admin/apps', { headers: headers() });
  return handleResponse(res);
}

export async function createApp(app) {
  const res = await fetch('/api/admin/apps', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(app),
  });
  return handleResponse(res);
}

export async function updateApp(id, app) {
  const res = await fetch(`/api/admin/apps/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(app),
  });
  return handleResponse(res);
}

export async function deleteApp(id) {
  const res = await fetch(`/api/admin/apps/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return handleResponse(res);
}

export async function reorderApps(order) {
  const res = await fetch('/api/admin/apps/reorder', {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ order }),
  });
  return handleResponse(res);
}
