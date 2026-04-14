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
 *
 * @param {string}   taskId   — task to comment on
 * @param {string}   text     — comment body
 * @param {string[]} mentions — array of user IDs that were @mentioned
 */
export const addComment = async (taskId, text, mentions = [], replyTo = null) => {
  const { data } = await api.post(`/api/tasks/${taskId}/comments`, { text, mentions, replyTo });
  return data.comment;
};
