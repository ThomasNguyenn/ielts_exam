import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET || 'https://ielts-exam-65pjc.ondigitalocean.app';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      include: ['react-resizable-panels'],
    },
    base: '/',
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
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
  };
});
