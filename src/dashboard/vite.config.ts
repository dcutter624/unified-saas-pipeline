import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }
          if (id.includes('@mui/x-data-grid')) {
            return 'mui-grid'
          }
          if (id.includes('@mui/x-charts')) {
            return 'mui-charts'
          }
          if (id.includes('@mui')) {
            return 'mui'
          }
          if (
            id.includes('react-router') ||
            id.includes('/react/') ||
            id.includes('react-dom') ||
            id.includes('scheduler')
          ) {
            return 'react-vendor'
          }
          if (id.includes('axios')) {
            return 'axios'
          }
        },
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
})
