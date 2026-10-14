import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      // API REST + WebSocket temps réel (/api/v1/ws) du backend local
      '/api': {
        // target: 'http://localhost:8000',
        target: 'https://backend-g8cb.onrender.com/',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})