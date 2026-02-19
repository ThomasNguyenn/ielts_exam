import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/theme.css';
import './styles/index.css';
import './styles/App.css';
import './styles/App-mobile.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Register Service Worker for PWA (prod only)
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration);

          const promptUpdate = (worker) => {
            if (!worker) return;
            worker.postMessage({ type: 'SKIP_WAITING' });
          };

          if (registration.waiting) {
            promptUpdate(registration.waiting);
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                promptUpdate(newWorker);
              }
            });
          });

          let hasRefreshed = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (hasRefreshed) return;
            hasRefreshed = true;
            window.location.reload();
          });

          // Force a check for new SW on load and periodically while tab is open.
          registration.update().catch(() => undefined);
          const updateIntervalMs = 5 * 60 * 1000;
          setInterval(() => {
            registration.update().catch(() => undefined);
          }, updateIntervalMs);
        })
        .catch((error) => {
          console.log('[PWA] Service Worker registration failed:', error);
        });
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  }
}
