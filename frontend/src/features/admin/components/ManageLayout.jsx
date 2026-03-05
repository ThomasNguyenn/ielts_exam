import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import '../pages/Manage.css';

const manageRoutePreloaders = {
  '/admin/manage/passages': () => import('../pages/ManagePassagesSinglePage'),
  '/admin/manage/sections': () => import('../pages/ManageSectionsSinglePage'),
  '/admin/manage/writings': () => import('../pages/ManageWritingsSinglePage'),
  '/admin/manage/speaking': () => import('../pages/ManageSpeakingSinglePage'),
  '/admin/manage/tests': () => import('../pages/ManageTestsSinglePage'),
  '/admin/manage/skill-modules': () => import('../pages/AddSkillModules'),
};

const preloadedManageRoutes = new Set();

const preloadManageRoute = (path) => {
  const loader = manageRoutePreloaders[path];
  if (!loader || preloadedManageRoutes.has(path)) return;

  preloadedManageRoutes.add(path);
  void loader();
};

export default function ManageLayout() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const preloadAllManageRoutes = () => {
      Object.keys(manageRoutePreloaders).forEach((path) => preloadManageRoute(path));
    };

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(preloadAllManageRoutes, { timeout: 1200 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(preloadAllManageRoutes, 200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="manage-page manage-page--editor">
      <main className="manage-shell-content">
        <Outlet />
      </main>
    </div>
  );
}

