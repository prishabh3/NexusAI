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

// Use @/lib/api/analyses and @/lib/api/insights for analysis/insight operations.
export { analysesApi } from "./analyses";
export { insightsApi } from "./insights";
