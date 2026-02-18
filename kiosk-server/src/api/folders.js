import { handleResponse, UnauthorizedError } from './client.js';
import { createCrudApi } from './crud.js';

export { UnauthorizedError };

const crud = createCrudApi('/api/admin/folders');
export const fetchAllFolders = crud.fetchAll;
export const createFolder = crud.create;
export const updateFolder = crud.update;
export const deleteFolder = crud.delete;
export const reorderFolders = crud.reorder;

export async function fetchFolders(profileId) {
  const url = profileId ? `/api/folders?profile=${profileId}` : '/api/folders';
  const res = await fetch(url);
  return handleResponse(res);
}
