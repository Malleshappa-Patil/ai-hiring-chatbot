import { apiClient } from './client';

export const analyticsApi = {
  dashboard: async () => {
    const res = await apiClient.get('/analytics/dashboard');
    return res.data;
  },
  funnel: async (jobId?: string) => {
    const res = await apiClient.get('/analytics/funnel', { params: { job_id: jobId } });
    return res.data;
  },
  trends: async (months = 6) => {
    const res = await apiClient.get('/analytics/trends', { params: { months } });
    return res.data;
  }
};
