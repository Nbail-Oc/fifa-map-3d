import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5173,
    allowedHosts: ['.trycloudflare.com'] // Allow all Cloudflare Tunnel subdomains
  },
  build: {
    rollupOptions: {
      input: {
        main:  resolve(__dirname, 'index.html'),
        staff: resolve(__dirname, 'staff.html')
      }
    }
  }
});
