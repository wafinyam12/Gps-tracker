import apiClient from '../client';
import { getJakartaDateString } from '../../utils/date';

const todayParams = () => ({ date: getJakartaDateString() });

export const locationService = {
  getLiveLocations: async () => apiClient.get('/location/live'),
  getSalesLocation: async (userId) => apiClient.get(`/location/${userId}`),
  getLocationHistory: async (userId, params) => apiClient.get(`/location/history/${userId}`, { params: params || todayParams() }),
};
