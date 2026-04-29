import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Single-page app — all routes serve index.html
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5173,
  },
})