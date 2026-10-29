import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../',
  resolve: {
    alias: {
      '@data': fileURLToPath(new URL('../data', import.meta.url)),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
    port: 5173,
    proxy: {
      '/chat': 'http://localhost:8000',
      '/approvals': 'http://localhost:8000',
      '/dashboard': 'http://localhost:8000',
      '/audit': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/users': 'http://localhost:8000',
    },
  },
})
