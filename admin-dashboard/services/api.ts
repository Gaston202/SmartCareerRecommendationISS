import axios from "axios";

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    // TODO: Get token from your auth solution (NextAuth session)
    // Example: const token = getToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle specific error codes
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Unauthorized - redirect to login or refresh token
          console.error("Unauthorized access - authentication required");
          // TODO: Implement logout or token refresh logic
          break;
        case 403:
          // Forbidden
          console.error("Access forbidden - insufficient permissions");
          break;
        case 404:
          // Not found
          console.error("Resource not found - endpoint may be incorrect");
          break;
        case 500:
          // Server error
          console.error("Server error - please try again later");
          break;
        default:
          console.error("An error occurred:", error.response.status);
      }
    } else if (error.request) {
      // Request made but no response
      if (error.code === "ECONNABORTED") {
        console.error("Request timeout - server took too long to respond");
      } else {
        console.error("No response from server - please check your connection");
      }
    } else {
      // Other errors
      console.error("Request error:", error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
