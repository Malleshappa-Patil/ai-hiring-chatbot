import { apiClient } from './client';

export const workflowApi = {
  start: async (jobId: string, goal: string) => {
    const res = await apiClient.post('/workflow/start', { job_id: jobId, goal });
    return res.data;
  },
  status: async (jobId: string) => {
    const res = await apiClient.get(`/workflow/${jobId}/status`);
    return res.data;
  },
  logs: async (jobId: string) => {
    const res = await apiClient.get(`/workflow/${jobId}/logs`, { params: { limit: 100 } });
    return res.data;
  },
  retryInterview: async (jobId: string) => {
    const res = await apiClient.post(`/workflow/${jobId}/retry-interview`);
    return res.data;
  },
};
