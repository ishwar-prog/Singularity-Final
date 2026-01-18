// API configuration for different environments
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = {
  baseUrl: API_BASE_URL,
  endpoints: {
    analyze: `${API_BASE_URL}/analyze`,
    analyzeImage: `${API_BASE_URL}/analyze-image`,
    analyzeImageUpload: `${API_BASE_URL}/analyze-image-upload`,
    nearbyDisasters: `${API_BASE_URL}/nearby-disasters`,
  }
};

export default api;
