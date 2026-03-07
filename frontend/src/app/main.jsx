import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from '@/shared/components/ErrorBoundary';
import './styles/theme.css';
import './styles/index.css';
import './styles/App.css';
import './styles/App-mobile.css';

const SW_CACHE_PREFIX = 'ielts-learning-';
const SW_DEFERRED_RELOAD_KEY = 'ielts-sw-reload-pending';
const SW_CRITICAL_PATH_PATTERNS = [
  /^\/student-ielts\/tests\/[^/]+\/exam(?:\/|$)/,
  /^\/student-ielts\/tests\/writing(?:\/|$)/,
  /^\/student-ielts\/practice\/[^/]+(?:\/|$)/,
  /^\/student-ielts\/speaking\/[^/]+(?:\/|$)/,
  /^\/student-(?:ielts|aca)\/homework(?:\/|$)/,
];

function isCriticalPath(pathname = '') {
  return SW_CRITICAL_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function hasActiveTextInput() {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;

  if (active instanceof HTMLTextAreaElement) return true;

  if (active instanceof HTMLInputElement) {
    const nonTypingInputTypes = new Set([
      'button',
      'checkbox',
      'color',
      'date',
      'datetime-local',
      'file',
      'hidden',
      'image',
      'month',
      'radio',
      'range',
      'reset',
      'submit',
      'time',
      'week',
    ]);
    return !nonTypingInputTypes.has(String(active.type || '').toLowerCase());
  }

  return Boolean(active.isContentEditable);
}

function shouldDeferControllerReload() {
  if (typeof window === 'undefined') return false;
  return isCriticalPath(window.location.pathname) || hasActiveTextInput();
}

function getPendingReloadFlag() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SW_DEFERRED_RELOAD_KEY) === '1';
  } catch {
    return false;
  }
}

function setPendingReloadFlag(value) {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.sessionStorage.setItem(SW_DEFERRED_RELOAD_KEY, '1');
      return;
    }
    window.sessionStorage.removeItem(SW_DEFERRED_RELOAD_KEY);
  } catch {
    // Ignore storage write errors.
  }
}

async function cleanupAppCaches({ keep = [] } = {}) {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  const cacheNames = await window.caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.startsWith(SW_CACHE_PREFIX) && !keep.includes(name))
      .map((name) => window.caches.delete(name))
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

// Register Service Worker for PWA (prod only)
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration);
          let hasReloadedForControllerChange = false;
          const reloadForControllerChange = () => {
            if (hasReloadedForControllerChange) return;
            hasReloadedForControllerChange = true;
            setPendingReloadFlag(false);
            window.location.reload();
          };

          const maybeApplyDeferredReload = () => {
            if (!getPendingReloadFlag()) return;
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            if (shouldDeferControllerReload()) return;
            reloadForControllerChange();
          };

          window.addEventListener('focus', maybeApplyDeferredReload);
          if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', maybeApplyDeferredReload);
          }

          const deferredReloadInterval = window.setInterval(maybeApplyDeferredReload, 15000);

          maybeApplyDeferredReload();
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (hasReloadedForControllerChange) return;
            if (shouldDeferControllerReload()) {
              setPendingReloadFlag(true);
              return;
            }
            reloadForControllerChange();
          });

          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version downloaded. Applying now...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });

          // Force a check for new SW on load and periodically while tab is open.
          registration.update().catch(() => undefined);
          const updateIntervalMs = 5 * 60 * 1000;
          setInterval(() => {
            registration.update().catch(() => undefined);
          }, updateIntervalMs);

          window.addEventListener('beforeunload', () => {
            window.clearInterval(deferredReloadInterval);
          });
        })
        .catch((error) => {
          console.log('[PWA] Service Worker registration failed:', error);
        });
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
    cleanupAppCaches().catch(() => undefined);
  }
}
