// Bare-fetch API for the game manage tabs. These pages run in the Electron
// content view, which injects the X-Kiosk-Token header automatically.
async function req(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const d = await res.json(); if (d.error) msg = d.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

const jsonPost = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const gamesApi = {
  getGame: (id) => req(`/api/games/${id}`),
  listTextures: (id) => req(`/api/games/${id}/textures`),
  listMeshes: (id) => req(`/api/games/${id}/meshes`),
  listCommits: (id) => req(`/api/games/${id}/commits`),
  getJob: (id, jobId) => req(`/api/games/${id}/jobs/${jobId}`),
  modify: (id, prompt) => req(`/api/games/${id}/update`, jsonPost({ prompt })),
  revert: (id, hash) => req(`/api/games/${id}/commits/${hash}/revert`, jsonPost({})),
  refineTexture: (id, assetId, refinement) => req(`/api/games/${id}/textures/${assetId}/refine`, jsonPost({ refinement })),
  refineMesh: (id, assetId, refinement) => req(`/api/games/${id}/meshes/${assetId}/refine`, jsonPost({ refinement })),
};
