import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/static/admin/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: { outDir: '../portal/static/admin', emptyOutDir: true },
  server: { proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } } },
})
