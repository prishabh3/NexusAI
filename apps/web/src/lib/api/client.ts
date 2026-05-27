import axios, { type AxiosInstance, type AxiosResponse } from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${BASE_URL}/api/v1`,
    headers: { "Content-Type": "application/json" },
    timeout: 30_000,
  });

  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error) => {
      const message =
        error.response?.data?.detail ?? error.message ?? "Unknown error";
      return Promise.reject(new Error(message));
    }
  );

  return client;
}

export const apiClient = createApiClient();
