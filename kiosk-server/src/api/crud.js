import { authHeaders, handleResponse } from './client.js';

export function createCrudApi(basePath) {
  return {
    fetchAll(profileId) {
      const url = profileId ? `${basePath}?profile=${profileId}` : basePath;
      return fetch(url, { headers: authHeaders() }).then(handleResponse);
    },
    create(data) {
      return fetch(basePath, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse);
    },
    update(id, data) {
      return fetch(`${basePath}/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse);
    },
    delete(id) {
      return fetch(`${basePath}/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }).then(handleResponse);
    },
    reorder(order) {
      return fetch(`${basePath}/reorder`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ order }),
      }).then(handleResponse);
    },
  };
}
