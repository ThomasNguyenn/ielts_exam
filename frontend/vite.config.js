import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// Custom plugin: stamp sw.js with build timestamp so cache auto-busts on deploy
function swTimestampPlugin() {
  return {
    name: 'sw-timestamp',
    closeBundle() {
      const swPath = path.resolve('dist', 'sw.js');
      if (!fs.existsSync(swPath)) return;
      const content = fs.readFileSync(swPath, 'utf-8');
      const stamped = content.replace('__BUILD_TIMESTAMP__', Date.now().toString());
      fs.writeFileSync(swPath, stamped);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_URL || 'https://ielts-exam-65pjc.ondigitalocean.app';

  return {
    plugins: [react(), swTimestampPlugin()],
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
