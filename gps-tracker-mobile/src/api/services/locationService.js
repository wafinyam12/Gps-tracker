import apiClient from '../client';
import { getJakartaDateString } from '../../utils/date';

const todayParams = () => ({ date: getJakartaDateString() });

export const locationService = {
  getLiveLocations: async (params) => apiClient.get('/location/live', { params }),
  getCustomerMarkers: async (params) => apiClient.get('/location/customer-markers', { params }),
  getSalesLocation: async (userId) => apiClient.get(`/location/${userId}`),
  getLocationHistory: async (userId, params) => apiClient.get(`/location/history/${userId}`, { params: params || todayParams() }),
};
