const getToken = () => localStorage.getItem('adminToken');

const headers = () => ({
  'Content-Type': 'application/json',
  'X-Admin-Token': getToken(),
});

export async function verifyPin(pin) {
  const res = await fetch('/api/admin/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const error = await res.json();
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
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to change PIN');
  }
  return res.json();
}

export async function fetchAllApps() {
  const res = await fetch('/api/admin/apps', { headers: headers() });
  if (!res.ok) {
    throw new Error('Failed to fetch apps');
  }
  return res.json();
}

export async function fetchBuiltinApps() {
  const res = await fetch('/api/builtin-apps');
  if (!res.ok) {
    throw new Error('Failed to fetch built-in apps');
  }
  return res.json();
}

export async function createApp(app) {
  const res = await fetch('/api/admin/apps', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(app),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create app');
  }
  return res.json();
}

export async function updateApp(id, app) {
  const res = await fetch(`/api/admin/apps/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(app),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update app');
  }
  return res.json();
}

export async function deleteApp(id) {
  const res = await fetch(`/api/admin/apps/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error('Failed to delete app');
  }
}

export async function reorderApps(order) {
  const res = await fetch('/api/admin/apps/reorder', {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ order }),
  });
  if (!res.ok) {
    throw new Error('Failed to reorder apps');
  }
  return res.json();
}
