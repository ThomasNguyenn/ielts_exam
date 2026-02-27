import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
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
    plugins: [react(), basicSsl(), swTimestampPlugin()],
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
      https: true,
      port: 3000,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('vite/preload-helper') ||
              id.includes('commonjsHelpers.js')
            ) {
              return 'vendor-runtime';
            }

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

            if (
              id.includes('react-markdown') ||
              id.includes('/remark-') ||
              id.includes('/rehype-') ||
              id.includes('/micromark') ||
              id.includes('/mdast-util-') ||
              id.includes('/hast-util-') ||
              id.includes('/unist-')
            ) {
              return 'vendor-markdown';
            }

            if (
              id.includes('dompurify') ||
              id.includes('html-react-parser') ||
              id.includes('/htmlparser2') ||
              id.includes('/domhandler') ||
              id.includes('/domutils') ||
              id.includes('/entities')
            ) {
              return 'vendor-html';
            }

            if (
              id.includes('react-router-dom') ||
              id.includes('/react-router/') ||
              id.includes('@remix-run/router')
            ) {
              return 'vendor-router';
            }

            if (
              id.includes('/react/') ||
              id.includes('react-dom') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }

            return undefined;
          },
        },
      },
    },
  };
});
