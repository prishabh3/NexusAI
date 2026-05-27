import { apiClient } from "./client";
import type { Insight } from "@/types/dataset";

export const insightsApi = {
  getByDataset: async (datasetId: string): Promise<Insight[]> => {
    const { data } = await apiClient.get(`/insights/dataset/${datasetId}`);
    return data;
  },

  getById: async (id: string): Promise<Insight> => {
    const { data } = await apiClient.get(`/insights/${id}`);
    return data;
  },

  getRecent: async (limit = 50): Promise<Insight[]> => {
    const { data } = await apiClient.get("/insights", { params: { limit } });
    return data;
  },

  verify: async (id: string): Promise<Insight> => {
    const { data } = await apiClient.post(`/insights/${id}/verify`);
    return data;
  },

  getSimilar: async (id: string): Promise<Insight[]> => {
    const { data } = await apiClient.get(`/insights/${id}/similar`);
    return data;
  },
};
