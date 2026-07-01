import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Emit hashed build assets under /static (not the default /assets) so they don't
  // collide with the server's /assets route that serves seed garment art when the
  // built app is served from the same Express server in production.
  build: {
    assetsDir: 'static',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
      '/assets': 'http://localhost:5000',
    },
  },
});
