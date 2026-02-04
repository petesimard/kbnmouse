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

export async function fetchAllChallenges() {
  const res = await fetch('/api/admin/challenges', { headers: headers() });
  return handleResponse(res);
}

export async function createChallenge(challenge) {
  const res = await fetch('/api/admin/challenges', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(challenge),
  });
  return handleResponse(res);
}

export async function updateChallenge(id, challenge) {
  const res = await fetch(`/api/admin/challenges/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(challenge),
  });
  return handleResponse(res);
}

export async function deleteChallenge(id) {
  const res = await fetch(`/api/admin/challenges/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return handleResponse(res);
}

export async function reorderChallenges(order) {
  const res = await fetch('/api/admin/challenges/reorder', {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ order }),
  });
  return handleResponse(res);
}
