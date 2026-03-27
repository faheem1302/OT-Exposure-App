import axios from "axios";

/**
 * Central axios instance. Base URL is read from REACT_APP_API_URL at build time.
 * Never hardcode http://localhost:8000 here — use .env files instead.
 */
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// REQUEST interceptor — attach API key on every request
apiClient.interceptors.request.use(
  (config) => {
    const key = process.env.REACT_APP_API_KEY;
    if (key) config.headers["X-API-Key"] = key;
    return config;
  },
  (error) => Promise.reject(error)
);

// RESPONSE interceptor — unified error logging
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(
      "[API Error]",
      error?.config?.url,
      error?.response?.status,
      error?.message
    );
    return Promise.reject(error);
  }
);

export default apiClient;
