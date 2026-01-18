import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      '/analyze': 'http://localhost:8000',
      '/analyze-image': 'http://localhost:8000',
      '/analyze-image-upload': 'http://localhost:8000',
      '/nearby-disasters': 'http://localhost:8000',
    }
  }
})
