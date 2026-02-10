import { authHeaders, handleResponse, UnauthorizedError } from './client.js';

export { UnauthorizedError };

// --- Public (kid-facing) ---

export async function fetchMessages(profileId) {
  const res = await fetch(`/api/messages?profile=${profileId}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

export async function sendMessage({ sender_profile_id, recipient_type, recipient_profile_id, content }) {
  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender_profile_id, recipient_type, recipient_profile_id, content }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

export async function markMessageRead(id) {
  const res = await fetch(`/api/messages/${id}/read`, { method: 'PUT' });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

export async function fetchKidUnreadCount(profileId) {
  const res = await fetch(`/api/messages/unread-count?profile=${profileId}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

// --- Admin (parent-facing) ---

export async function fetchAdminMessages(profileId) {
  const url = profileId ? `/api/admin/messages?profile=${profileId}` : '/api/admin/messages';
  const res = await fetch(url, { headers: authHeaders() });
  return handleResponse(res);
}

export async function sendAdminMessage({ recipient_type, recipient_profile_id, content }) {
  const res = await fetch('/api/admin/messages', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ recipient_type, recipient_profile_id, content }),
  });
  return handleResponse(res);
}

export async function markAdminMessageRead(id) {
  const res = await fetch(`/api/admin/messages/${id}/read`, {
    method: 'PUT',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function fetchProfileAllMessages(profileId) {
  const res = await fetch(`/api/admin/messages/profile-all?profile=${profileId}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchUnreadCount() {
  const res = await fetch('/api/admin/messages/unread-count', { headers: authHeaders() });
  return handleResponse(res);
}
