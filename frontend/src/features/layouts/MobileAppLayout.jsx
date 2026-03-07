import { Fragment, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  Languages,
  Mic,
  Pencil,
  UserCircle,
  Library,
} from 'lucide-react';
import './MobileAppLayout.css';

const BASE = '/student-ielts';

const TABS = [
  {
    key: 'homework',
    label: 'Bài Tập',
    to: `${BASE}/homework`,
    icon: ClipboardList,
    matchPrefix: `${BASE}/homework`,
  },
  {
    key: 'ielts',
    label: 'IELTS Zone',
    to: `${BASE}/tests`,
    icon: BookOpen,
    matchPrefix: [
      `${BASE}/tests`,
      `${BASE}/practice`,
      `${BASE}/speaking`,
    ],
  },
  {
    key: 'vocabulary',
    label: 'Quizlet',
    to: `${BASE}/vocabulary`,
    icon: Languages,
    matchPrefix: `${BASE}/vocabulary`,
  },
  {
    key: 'profile',
    label: 'Profile',
    to: `${BASE}/profile`,
    icon: UserCircle,
    matchPrefix: `${BASE}/profile`,
  },
];

const IELTS_SUB_ITEMS = [
  { key: 'tests', label: 'Full Tests', to: `${BASE}/tests`, icon: Library },
  { key: 'practice', label: 'Writing', to: `${BASE}/practice`, icon: Pencil },
  { key: 'speaking', label: 'Speaking', to: `${BASE}/speaking`, icon: Mic },
];

const isTabActive = (tab, pathname) => {
  if (Array.isArray(tab.matchPrefix)) {
    return tab.matchPrefix.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }
  return pathname === tab.matchPrefix || pathname.startsWith(`${tab.matchPrefix}/`);
};

export default function MobileAppLayout() {
  const { pathname } = useLocation();

  const activeTabKey = useMemo(() => {
    for (const tab of TABS) {
      if (isTabActive(tab, pathname)) return tab.key;
    }
    return null;
  }, [pathname]);

  const showIeltsSubnav = activeTabKey === 'ielts';

  return (
    <div className="mobile-app-shell">
      {/* ── Header ─────────────────────────────── */}
      <header className="mobile-app-header">
        <span className="mobile-app-header__brand">IELTS MASTER</span>
      </header>

      {/* ── IELTS Zone sub-nav pills ───────────── */}
      {showIeltsSubnav && (
        <nav className="mobile-app-subnav">
          {IELTS_SUB_ITEMS.map((item) => {
            const isActive =
              pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.to}
                className={`mobile-app-subnav__pill ${isActive ? 'active' : ''}`}
              >
                <Icon className="mobile-app-subnav__pill-icon" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      )}

      {/* ── Main scrollable content ────────────── */}
      <main className="mobile-app-content">
        <div className="mobile-app-content__inner" key={pathname}>
          <Outlet />
        </div>
      </main>

      {/* ── Bottom tab bar ─────────────────────── */}
      <nav className="mobile-tab-bar">
        {TABS.map((tab) => {
          const active = tab.key === activeTabKey;
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.key}
              to={tab.to}
              className={`mobile-tab-bar__item ${active ? 'active' : ''}`}
            >
              <Icon className="mobile-tab-bar__icon" />
              <span className="mobile-tab-bar__label">{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
