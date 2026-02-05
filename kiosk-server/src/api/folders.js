const TOKEN_KEY = 'adminToken';

const getToken = () => localStorage.getItem(TOKEN_KEY);

const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const headers = () => ({
  'Content-Type': 'application/json',
  'X-Admin-Token': getToken(),
});

class UnauthorizedError extends Error {
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

export async function fetchFolders(profileId) {
  const url = profileId ? `/api/folders?profile=${profileId}` : '/api/folders';
  const res = await fetch(url);
  return handleResponse(res);
}

export async function fetchAllFolders(profileId) {
  const url = profileId ? `/api/admin/folders?profile=${profileId}` : '/api/admin/folders';
  const res = await fetch(url, { headers: headers() });
  return handleResponse(res);
}

export async function createFolder(folder) {
  const res = await fetch('/api/admin/folders', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(folder),
  });
  return handleResponse(res);
}

export async function updateFolder(id, folder) {
  const res = await fetch(`/api/admin/folders/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(folder),
  });
  return handleResponse(res);
}

export async function deleteFolder(id) {
  const res = await fetch(`/api/admin/folders/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return handleResponse(res);
}

export async function reorderFolders(order) {
  const res = await fetch('/api/admin/folders/reorder', {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ order }),
  });
  return handleResponse(res);
}

export { UnauthorizedError };
