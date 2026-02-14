import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react-resizable-panels'],
  },
  base: '/',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://ielts-exam-65pjc.ondigitalocean.app',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('recharts')) {
            return 'vendor-recharts';
          }

          if (id.includes('jspdf') || id.includes('html2canvas')) {
            return 'vendor-pdf';
          }

          if (id.includes('@dnd-kit')) {
            return 'vendor-dnd';
          }

          if (id.includes('react-resizable-panels')) {
            return 'vendor-panels';
          }

          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }

          return 'vendor';
        },
      },
    },
  },
});
