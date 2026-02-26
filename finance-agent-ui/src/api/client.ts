import axios from "axios";

export const API_URL = import.meta.env.VITE_BACKEND_API_URL;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 5000,
  headers: {
    "Content-Type": "application/json"
  }
});
