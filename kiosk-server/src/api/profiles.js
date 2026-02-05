const TOKEN_KEY = 'adminToken';

const getToken = () => localStorage.getItem(TOKEN_KEY);

const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const headers = () => ({
  'Content-Type': 'application/json',
  'X-Admin-Token': getToken(),
});

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

async function handleResponse(res) {
  if (res.status === 401) {
    clearToken();
    throw new UnauthorizedError();
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Request failed');
  }
  if (res.status === 204) {
    return null;
  }
  return res.json();
}

// Public endpoints
export async function fetchProfiles() {
  const res = await fetch('/api/profiles');
  return res.json();
}

export async function fetchActiveProfile() {
  const res = await fetch('/api/active-profile');
  return res.json();
}

export async function setActiveProfile(profileId) {
  const res = await fetch('/api/active-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_id: profileId }),
  });
  return res.json();
}

// Admin endpoints
export async function fetchAllProfiles() {
  const res = await fetch('/api/admin/profiles', { headers: headers() });
  return handleResponse(res);
}

export async function createProfile(profile) {
  const res = await fetch('/api/admin/profiles', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(profile),
  });
  return handleResponse(res);
}

export async function updateProfile(id, profile) {
  const res = await fetch(`/api/admin/profiles/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(profile),
  });
  return handleResponse(res);
}

export async function deleteProfile(id) {
  const res = await fetch(`/api/admin/profiles/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return handleResponse(res);
}

export async function reorderProfiles(order) {
  const res = await fetch('/api/admin/profiles/reorder', {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ order }),
  });
  return handleResponse(res);
}
