import api from './api';

/**
 * GET /api/boards?org=:orgId — list boards for an organisation.
 */
export const getBoards = async (orgId) => {
  const { data } = await api.get('/api/boards', { params: { org: orgId } });
  return data.boards;
};

/**
 * GET /api/dashboard/stats?org=:orgId — aggregated workspace stats.
 */
export const getDashboardStats = async (orgId) => {
  const { data } = await api.get('/api/dashboard/stats', {
    params: { org: orgId },
  });
  return data;
};

/**
 * POST /api/boards — create a board (admin only).
 * @param {{ name: string, visibility: 'public'|'private', organisation: string }} payload
 */
export const createBoard = async (payload) => {
  const { data } = await api.post('/api/boards', payload);
  return data.board;
};

/**
 * PUT /api/boards/:id — update a board (admin only).
 */
export const updateBoard = async (id, payload) => {
  const { data } = await api.put(`/api/boards/${id}`, payload);
  return data.board;
};

/**
 * DELETE /api/boards/:id — delete board + cascade (admin only).
 */
export const deleteBoard = async (id) => {
  const { data } = await api.delete(`/api/boards/${id}`);
  return data;
};
