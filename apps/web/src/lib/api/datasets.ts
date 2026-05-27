import { apiClient } from "./client";
import type { Dataset, DatasetDetail, DatasetUploadParams } from "@/types/dataset";

export const datasetsApi = {
  list: async (params?: { limit?: number; offset?: number }): Promise<Dataset[]> => {
    const { data } = await apiClient.get<Dataset[]>("/datasets", { params });
    return data;
  },

  get: async (id: string): Promise<DatasetDetail> => {
    const { data } = await apiClient.get<DatasetDetail>(`/datasets/${id}`);
    return data;
  },

  upload: async ({ file, name, description, tags }: DatasetUploadParams): Promise<DatasetDetail> => {
    const form = new FormData();
    form.append("file", file);
    form.append("name", name);
    if (description) form.append("description", description);
    if (tags?.length) form.append("tags", tags.join(","));
    const { data } = await apiClient.post<DatasetDetail>("/datasets", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/datasets/${id}`);
  },

  getVersions: async (id: string) => {
    const { data } = await apiClient.get(`/datasets/${id}/versions`);
    return data;
  },

  search: async (q: string, limit = 20): Promise<Dataset[]> => {
    const { data } = await apiClient.get<Dataset[]>("/datasets/search", { params: { q, limit } });
    return data;
  },
};

export const analysesApi = {
  run: async (payload: {
    dataset_id: string;
    analysis_type: string;
    user_query?: string;
    configuration?: Record<string, unknown>;
  }) => {
    const { data } = await apiClient.post("/analyses", payload);
    return data;
  },

  get: async (id: string) => {
    const { data } = await apiClient.get(`/analyses/${id}`);
    return data;
  },

  listForDataset: async (datasetId: string, params?: { limit?: number; offset?: number }) => {
    const { data } = await apiClient.get(`/analyses/dataset/${datasetId}`, { params });
    return data;
  },

  recent: async (limit = 10) => {
    const { data } = await apiClient.get("/analyses/recent", { params: { limit } });
    return data;
  },
};

export const insightsApi = {
  listForDataset: async (datasetId: string, params?: { category?: string; limit?: number }) => {
    const { data } = await apiClient.get(`/insights/dataset/${datasetId}`, { params });
    return data;
  },

  get: async (id: string) => {
    const { data } = await apiClient.get(`/insights/${id}`);
    return data;
  },

  verify: async (id: string, notes?: string) => {
    const { data } = await apiClient.post(`/insights/${id}/verify`, null, { params: { notes } });
    return data;
  },

  similar: async (id: string, limit = 5) => {
    const { data } = await apiClient.get(`/insights/${id}/similar`, { params: { limit } });
    return data;
  },
};
