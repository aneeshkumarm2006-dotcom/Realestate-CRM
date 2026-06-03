import api from './api';

/**
 * GET /api/boards/:boardId/automations — list automations for a board.
 */
export const listAutomations = async (boardId) => {
  const { data } = await api.get(`/api/boards/${boardId}/automations`);
  return data.automations;
};

/**
 * POST /api/boards/:boardId/automations — create a new automation (admin only).
 */
export const createAutomation = async (boardId, payload) => {
  const { data } = await api.post(`/api/boards/${boardId}/automations`, payload);
  return data.automation;
};

/**
 * PUT /api/automations/:id — update an automation (admin only).
 */
export const updateAutomation = async (id, payload) => {
  const { data } = await api.put(`/api/automations/${id}`, payload);
  return data.automation;
};

/**
 * DELETE /api/automations/:id — delete an automation (admin only).
 */
export const deleteAutomation = async (id) => {
  const { data } = await api.delete(`/api/automations/${id}`);
  return data;
};

/**
 * POST /api/automations/:id/run-now — fire an automation immediately,
 * spawning one task. Updates lastRunAt but not nextRunAt.
 */
export const runAutomationNow = async (id) => {
  const { data } = await api.post(`/api/automations/${id}/run-now`);
  return data;
};

/**
 * GET /api/automations/:id/run-log — last 20 firings (most-recent-first) from
 * the automation's triggerHistory. Member-level access. (F4.6)
 */
export const getRunLog = async (id) => {
  const { data } = await api.get(`/api/automations/${id}/run-log`);
  return data.runLog || [];
};
