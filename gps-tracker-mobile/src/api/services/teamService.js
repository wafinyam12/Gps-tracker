import apiClient from '../client';

export const teamService = {
  getTeams: async (params) => apiClient.get('/teams', { params }),
  getTeam: async (id) => apiClient.get(`/teams/${id}`),
  createTeam: async (data) => apiClient.post('/teams', data),
  updateTeam: async (id, data) => apiClient.put(`/teams/${id}`, data),
  toggleActiveTeam: async (id) => apiClient.patch(`/teams/${id}/toggle-active`),
  deleteTeam: async (id) => apiClient.delete(`/teams/${id}`),
};