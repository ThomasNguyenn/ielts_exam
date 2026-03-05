import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '@/shared/api/client';
import './RoleLayouts.css';

const TABS = [
  { key: 'profile', label: 'Profile', to: '/student-ielts/profile' },
  { key: 'tests', label: 'Tests', to: '/student-ielts/tests' },
  { key: 'practice', label: 'Practice', to: '/student-ielts/practice' },
  { key: 'speaking', label: 'Speaking', to: '/student-ielts/speaking' },
  { key: 'learn', label: 'Learn', to: '/student-ielts/learn' },
  { key: 'analytics', label: 'Analytics', to: '/student-ielts/analytics' },
  { key: 'vocabulary', label: 'Vocabulary', to: '/student-ielts/vocabulary' },
  { key: 'achievements', label: 'Achievements', to: '/student-ielts/achievements' },
  { key: 'homework', label: 'Homework', to: '/student-ielts/homework' },
];

const isTabMatch = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);

export default function StudentIELTSLayout() {
  const pathname = useLocation().pathname;
  const userRole = String(api.getUser()?.role || '').trim();
  const hideTopNav = pathname.includes('/exam');

  return (
    <div className="role-shell">
      {!hideTopNav ? (
        <header className="role-shell__top">
          <div className="role-shell__top-inner">
            <div>
              <h1 className="role-shell__title">Student IELTS Workspace</h1>
              <p className="role-shell__subtitle">Practice, tests, analytics and homework in one layer.</p>
            </div>
            <div className="role-shell__meta">
              <span className="role-shell__badge">{userRole || 'studentIELTS'}</span>
            </div>
          </div>
          <nav className="role-shell__tabs" aria-label="Student IELTS tabs">
            {TABS.map((tab) => (
              <NavLink
                key={tab.key}
                to={tab.to}
                className={() => `role-shell__tab ${isTabMatch(pathname, tab.to) ? 'active' : ''}`}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </header>
      ) : null}

      <main className="role-shell__content">
        <Outlet />
      </main>
    </div>
  );
}
