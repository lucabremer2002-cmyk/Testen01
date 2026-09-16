import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the build also runs from a sub-path or a static host.
  base: './',
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, strictPort: false },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
