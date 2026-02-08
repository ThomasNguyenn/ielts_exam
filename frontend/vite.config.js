import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react-resizable-panels']
  },
  base: '/',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://ielts-exam-jh0q.onrender.com',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // Tăng giới hạn cảnh báo lên 1000kB
    rollupOptions: {
      output: {
        manualChunks: {
          // Tách các thư viện lớn ra thành chunk riêng
          'react-vendor': ['react', 'react-dom', 'react-router-dom']
        },
      },
    },
  },
});
