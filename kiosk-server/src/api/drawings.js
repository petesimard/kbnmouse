// Kiosk-facing API — bare fetch() (Electron injects X-Kiosk-Token automatically)

export async function fetchDrawings(profileId) {
  const res = await fetch(`/api/drawings?profile=${profileId}`);
  if (!res.ok) throw new Error('Failed to fetch drawings');
  return res.json();
}

export async function fetchDrawing(id) {
  const res = await fetch(`/api/drawings/${id}`);
  if (!res.ok) throw new Error('Failed to fetch drawing');
  return res.json();
}

export async function saveDrawing({ name, image_data, thumbnail, profile_id }) {
  const res = await fetch('/api/drawings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, image_data, thumbnail, profile_id }),
  });
  if (!res.ok) throw new Error('Failed to save drawing');
  return res.json();
}

export async function updateDrawing(id, { name, image_data, thumbnail }) {
  const res = await fetch(`/api/drawings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, image_data, thumbnail }),
  });
  if (!res.ok) throw new Error('Failed to update drawing');
  return res.json();
}

export async function deleteDrawing(id) {
  const res = await fetch(`/api/drawings/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete drawing');
  return res.json();
}

export async function stylizeDrawing({ image_data, style, profile_id }) {
  const res = await fetch('/api/drawings/stylize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_data, style, profile_id }),
  });
  if (!res.ok) throw new Error('Failed to stylize drawing');
  return res.json();
}
