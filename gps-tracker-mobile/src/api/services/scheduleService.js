import apiClient from '../client';

export const scheduleService = {
  getTodaySchedule: async () => apiClient.get('/schedule/today'),
  getScheduleByDate: async (params) => apiClient.get('/schedule/date', { params }),
  getTeamSummary: async (params) => apiClient.get('/schedule/summary', { params }),
  assignSchedule: async (data) => apiClient.post('/schedule/assign', data),
  bulkAssignSchedule: async (data) => apiClient.post('/schedule/bulk-assign', data),
  reorderSchedule: async (data) => apiClient.put('/schedule/reorder', data),
  deleteSchedule: async (id) => apiClient.delete(`/schedule/${id}`),
};