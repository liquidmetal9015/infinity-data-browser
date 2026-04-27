import axios from "axios";
import { auth } from "./firebase";

// Configure base URL from Vite env or fallback to local vs relative path
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:8000" : ""),
});

// Interceptor to inject Firebase token automatically
api.interceptors.request.use(async (config) => {
    const user = auth.currentUser;

    if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;
