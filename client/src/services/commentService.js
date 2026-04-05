import api from './api';

/**
 * GET /api/tasks/:taskId/comments
 *
 * Fetch the comment thread for a task. Comments are returned oldest-first,
 * with each comment's author populated (name, profilePic, email).
 */
export const getComments = async (taskId) => {
  const { data } = await api.get(`/api/tasks/${taskId}/comments`);
  return data.comments;
};

/**
 * POST /api/tasks/:taskId/comments
 *
 * Add a new comment to a task. The current user is attached server-side
 * as the author. Returns the populated comment.
 */
export const addComment = async (taskId, text) => {
  const { data } = await api.post(`/api/tasks/${taskId}/comments`, { text });
  return data.comment;
};
