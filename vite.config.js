import { defineConfig } from 'vite'

export default defineConfig({
  // Set base to relative for Electron compatibility later
  base: './',
  
  server: {
    port: 3000,
    // Proxy /api requests to Python backend during development
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  
  build: {
    chunkSizeWarningLimit: 2000,
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      // Don't bundle transformers.js - loaded from CDN
      external: ['@xenova/transformers'],
      output: {
        manualChunks: {
          'pdf-tools': ['pdfjs-dist', 'jspdf']
        }
      }
    }
  },
  
  optimizeDeps: {
    // Exclude problematic packages
    exclude: ['@xenova/transformers', 'onnxruntime-web', '@mlc-ai/web-llm']
  }
})
