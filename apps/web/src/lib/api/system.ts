import { apiClient } from "./client";

interface HealthResponse {
  status: string;
  ollama: "ok" | "error";
  database: "ok" | "error";
  version: string;
}

export const systemApi = {
  health: async (): Promise<HealthResponse> => {
    const { data } = await apiClient.get("/health");
    return data;
  },
};
