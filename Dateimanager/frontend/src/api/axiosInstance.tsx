import axios from 'axios';

const API_URL = 'http://localhost:8000'; // ggf. anpassen

const api = axios.create({
    baseURL: API_URL,
});

// Token automatisch an alle Requests anhängen
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Optional: bei 401 automatisch ausloggen
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("accessToken");
            // Optional: Weiterleitung zur Login-Seite oder Benachrichtigung
            console.warn("Token abgelaufen oder ungültig – Benutzer wurde ausgeloggt.");
        }
        return Promise.reject(error);
    }
);

export default api;
