import { authHeaders, handleResponse } from './client.js';

export async function register(email, password) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Registration failed');
  }
  return res.json();
}

export async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Login failed');
  }
  return res.json();
}

export async function logout() {
  const res = await fetch('/api/auth/session', {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function requestMagicLink(email) {
  const res = await fetch('/api/auth/magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function verifyMagicLink(token) {
  const res = await fetch('/api/auth/verify-magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Invalid or expired link');
  }
  return res.json();
}

export async function requestPasswordReset(email) {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function resetPassword(token, password) {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Password reset failed');
  }
  return res.json();
}

export async function changePassword(currentPassword, newPassword) {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return handleResponse(res);
}

export async function fetchKiosks() {
  const res = await fetch('/api/admin/kiosks', { headers: authHeaders() });
  return handleResponse(res);
}

export async function claimPairingCode(code, name) {
  const res = await fetch('/api/pairing/claim', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ code, name }),
  });
  return handleResponse(res);
}

export async function deleteKiosk(id) {
  const res = await fetch(`/api/admin/kiosks/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function fetchInstalledApps() {
  const res = await fetch('/api/admin/installed-apps', { headers: authHeaders() });
  return handleResponse(res);
}
