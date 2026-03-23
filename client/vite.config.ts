import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001'
    }
  },

  preview: {
    port: 4173
  },

  build: {
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — loaded on every page
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          // Router
          if (id.includes('node_modules/react-router')) {
            return 'router';
          }
          // Animation library (~100 kB)
          if (id.includes('node_modules/framer-motion')) {
            return 'framer-motion';
          }
          // Icon library (tree-shaken but still large when many icons are used)
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/react-icons')) {
            return 'icons';
          }
        }
      }
    }
  }
})
