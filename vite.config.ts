import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// In dev the browser talks to Vite, and Vite forwards /petclinic/* to the real
// backend. That keeps the app same-origin (no CORS) and mirrors production,
// where nginx does the same job (see Dockerfile / nginx.conf.template).
const backend = process.env.PETCLINIC_URL ?? 'http://localhost:9966'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { '/petclinic': { target: backend, changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/petclinic': { target: backend, changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    env: { VITE_API_BASE_URL: 'http://localhost:9966/petclinic/api' },
  },
})
