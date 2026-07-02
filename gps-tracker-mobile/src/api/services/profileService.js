import apiClient from '../client';

export const profileService = {
  updateProfile: async (data) => {
    const response = await apiClient.put('/auth/profile', data);
    return response.data;
  },

  changePassword: async (data) => {
    const response = await apiClient.post('/auth/change-password', data);
    return response.data;
  },

  updatePhoto: async (photo) => {
    const formData = new FormData();
    formData.append('photo', {
      uri: photo.uri,
      name: photo.fileName || photo.name || 'profile.jpg',
      type: photo.mimeType || 'image/jpeg',
    });

    const response = await apiClient.post('/auth/profile/photo', formData);
    return response.data;
  },
};
