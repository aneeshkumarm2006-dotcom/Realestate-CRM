import api from './api';

/**
 * GET /api/tasks?board=:id&group=:id
 *
 * List tasks for a board (optionally filtered by group).
 */
export const getTasks = async (boardId, groupId) => {
  const params = { board: boardId };
  if (groupId) params.group = groupId;
  const { data } = await api.get('/api/tasks', { params });
  return data.tasks;
};

/**
 * GET /api/tasks/my — current user's assigned + personal tasks.
 */
export const getMyTasks = async () => {
  const { data } = await api.get('/api/tasks/my');
  return data.tasks;
};

/**
 * GET /api/tasks/calendar?month=:m&year=:y&org=:orgId
 *
 * Return tasks with a `dueDate` in the given month. `month` is 1-12.
 * Admins get all board tasks; regular users get only assigned tasks on
 * public boards. Personal tasks are always included for the current user.
 */
export const getCalendarTasks = async (month, year, orgId) => {
  const params = { month, year };
  if (orgId) params.org = orgId;
  const { data } = await api.get('/api/tasks/calendar', { params });
  return data.tasks;
};

/**
 * POST /api/tasks — create a task.
 *
 * For board tasks, payload requires: name, board, group, priority, status,
 * assignedTo (string[]), dueDate (optional ISO string), note (optional).
 * For personal tasks, pass `isPersonal: true` (no board/group).
 */
export const createTask = async (payload) => {
  const { data } = await api.post('/api/tasks', payload);
  return data.task;
};

/**
 * PUT /api/tasks/:id — update a task. Partial update; only include the fields
 * to change.
 */
export const updateTask = async (id, payload) => {
  const { data } = await api.put(`/api/tasks/${id}`, payload);
  return data.task;
};

/**
 * DELETE /api/tasks/:id — delete a task.
 */
export const deleteTask = async (id) => {
  const { data } = await api.delete(`/api/tasks/${id}`);
  return data;
};

/**
 * GET /api/boards/:boardId/groups — list groups for a board.
 *
 * Groups are a task-adjacent concept and are used exclusively by the
 * board detail view, so we keep the API call alongside the task service.
 */
export const getGroups = async (boardId) => {
  const { data } = await api.get(`/api/boards/${boardId}/groups`);
  return data.groups;
};

/**
 * POST /api/boards/:boardId/groups — create a new group (admin only).
 */
export const createGroup = async (boardId, payload) => {
  const { data } = await api.post(`/api/boards/${boardId}/groups`, payload);
  return data.group;
};

/**
 * DELETE /api/groups/:id — delete a group and all its tasks (admin only).
 */
export const deleteGroup = async (groupId) => {
  const { data } = await api.delete(`/api/groups/${groupId}`);
  return data;
};
