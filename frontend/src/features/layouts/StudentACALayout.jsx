import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '@/shared/api/client';
import './RoleLayouts.css';

const isTabMatch = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);

export default function StudentACALayout() {
  const pathname = useLocation().pathname;
  const userRole = String(api.getUser()?.role || '').trim();

  return (
    <div className="role-shell">
      <header className="role-shell__top">
        <div className="role-shell__top-inner">
          <div>
            <h1 className="role-shell__title">Student ACA Workspace</h1>
            <p className="role-shell__subtitle">Academic track focused on monthly homework.</p>
          </div>
          <div className="role-shell__meta">
            <span className="role-shell__badge">{userRole || 'studentACA'}</span>
          </div>
        </div>
        <nav className="role-shell__tabs" aria-label="Student ACA tabs">
          <NavLink
            to="/student-aca/homework"
            className={() => `role-shell__tab ${isTabMatch(pathname, '/student-aca/homework') ? 'active' : ''}`}
          >
            Homework
          </NavLink>
        </nav>
      </header>

      <main className="role-shell__content">
        <Outlet />
      </main>
    </div>
  );
}
