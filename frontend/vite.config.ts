import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In Docker the backend is reachable via its service name.
// Locally it's on 127.0.0.1. VITE_BACKEND_URL lets us override at runtime.
const backendUrl = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
    },
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/socket.io': {
        target: backendUrl,
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
