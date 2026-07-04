import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // На случай, если мок в src/api/chat.ts заменят на реальный fetch("/api/chat") —
      // dev-сервер Vite будет проксировать запросы на backend (uvicorn, порт 8000).
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    outDir: 'dist',
  },
})
