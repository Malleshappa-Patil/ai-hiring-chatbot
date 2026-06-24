import { apiClient } from './client';

export const onboardingApi = {
  tasks: async (candidateId: string) => {
    const res = await apiClient.get(`/onboarding/${candidateId}/tasks`);
    return res.data;
  },
  updateTask: async (taskId: string, status: string) => {
    const res = await apiClient.put(`/onboarding/tasks/${taskId}`, { status });
    return res.data;
  }
};
