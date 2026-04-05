import api from './api';

export const updateProfile = async ({ name }) => {
  const { data } = await api.put('/api/profile', { name });
  return data.user;
};

export const uploadAvatar = async (file) => {
  const formData = new FormData();
  formData.append('avatar', file);
  const { data } = await api.post('/api/profile/upload-avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};
