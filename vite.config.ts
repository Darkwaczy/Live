import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      usePolling: true
    },
    headers: {
      "Cross-Origin-Embedder-Policy": "unsafe-none", // Allow standard Fetch but strict worker context
      "Cross-Origin-Opener-Policy": "same-origin",
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000
  }
});
