import { defineConfig } from 'vite';

export default defineConfig({
  base: '/mrt-squeeze/',
  server: { host: true, port: 5180, strictPort: true },
  build: { chunkSizeWarningLimit: 2000 },
});
