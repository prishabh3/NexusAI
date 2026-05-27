import { apiClient } from "./client";
import type { Analysis, AnalysisDetail } from "@/types/dataset";

export const analysesApi = {
  getById: async (id: string): Promise<AnalysisDetail> => {
    const { data } = await apiClient.get(`/analyses/${id}`);
    return data;
  },

  getByDataset: async (datasetId: string): Promise<Analysis[]> => {
    const { data } = await apiClient.get(`/analyses/dataset/${datasetId}`);
    return data;
  },

  getRecent: async (limit = 20): Promise<Analysis[]> => {
    const { data } = await apiClient.get("/analyses/recent", { params: { limit } });
    return data;
  },

  // Alias kept for callers that use the older naming convention
  recent: async (limit = 20): Promise<Analysis[]> => {
    const { data } = await apiClient.get("/analyses/recent", { params: { limit } });
    return data;
  },

  create: async (datasetId: string, query: string, analysisType = "custom_query"): Promise<Analysis> => {
    const { data } = await apiClient.post("/analyses", {
      dataset_id: datasetId,
      query,
      analysis_type: analysisType,
    });
    return data;
  },
};
