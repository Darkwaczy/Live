import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    headers: {
      "Cross-Origin-Embedder-Policy": "unsafe-none",
      "Cross-Origin-Opener-Policy": "same-origin",
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 10000, // Increased for AI workers
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          lucide: ['lucide-react']
        }
      }
    }
  },
  worker: {
    format: 'es'
  }
});
