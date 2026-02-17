import axios from "axios";

const VITE_BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

export const api = axios.create({
  baseURL: VITE_BACKEND_API_URL,
  timeout: 5000,
  headers: {
    "Content-Type": "application/json"
  }
});
