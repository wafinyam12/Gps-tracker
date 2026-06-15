import apiClient from '../client';

const todayParams = () => ({ date: new Date().toISOString().split('T')[0] });

export const locationService = {
  getLiveLocations: async () => apiClient.get('/location/live'),
  getSalesLocation: async (userId) => apiClient.get(`/location/${userId}`),
  getLocationHistory: async (userId, params) => apiClient.get(`/location/history/${userId}`, { params: params || todayParams() }),
};
