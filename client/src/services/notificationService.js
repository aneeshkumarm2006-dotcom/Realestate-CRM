import api from './api';

/**
 * GET /api/notifications — latest 50 notifications for the current user.
 * Returns { notifications, unreadCount }.
 */
export const getNotifications = async () => {
  const { data } = await api.get('/api/notifications');
  return data;
};

/**
 * PUT /api/notifications/:id/read — mark a single notification as read.
 */
export const markAsRead = async (id) => {
  const { data } = await api.put(`/api/notifications/${id}/read`);
  return data.notification;
};

/**
 * PUT /api/notifications/read-all — mark every unread notification as read.
 */
export const markAllAsRead = async () => {
  const { data } = await api.put('/api/notifications/read-all');
  return data;
};
