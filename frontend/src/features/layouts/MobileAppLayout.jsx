import { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  Languages,
  Library,
  Mic,
  Pencil,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import './MobileAppLayout.css';

const IELTS_BASE = '/student-ielts';
const ACA_BASE = '/student-aca';

const MOBILE_LAYOUTS = {
  ielts: {
    brand: 'IELTS MASTER',
    subnavTabKey: 'ielts',
    tabs: [
      {
        key: 'homework',
        label: 'Bai tap',
        to: `${IELTS_BASE}/homework`,
        icon: ClipboardList,
        matchPrefix: `${IELTS_BASE}/homework`,
      },
      {
        key: 'ielts',
        label: 'IELTS Zone',
        to: `${IELTS_BASE}/tests`,
        icon: BookOpen,
        matchPrefix: [
          `${IELTS_BASE}/tests`,
          `${IELTS_BASE}/practice`,
          `${IELTS_BASE}/speaking`,
        ],
      },
      {
        key: 'vocabulary',
        label: 'Quizlet',
        to: `${IELTS_BASE}/vocabulary`,
        icon: Languages,
        matchPrefix: `${IELTS_BASE}/vocabulary`,
      },
      {
        key: 'profile',
        label: 'Profile',
        to: `${IELTS_BASE}/profile`,
        icon: UserCircle,
        matchPrefix: [
          `${IELTS_BASE}/profile`,
          `${IELTS_BASE}/account-security`,
        ],
      },
    ],
    subItems: [
      { key: 'tests', label: 'Full Tests', to: `${IELTS_BASE}/tests`, icon: Library },
      { key: 'practice', label: 'Writing', to: `${IELTS_BASE}/practice`, icon: Pencil },
      { key: 'speaking', label: 'Speaking', to: `${IELTS_BASE}/speaking`, icon: Mic },
    ],
  },
  aca: {
    brand: 'ACA MASTER',
    subnavTabKey: null,
    tabs: [
      {
        key: 'homework',
        label: 'Bai tap',
        to: `${ACA_BASE}/homework`,
        icon: ClipboardList,
        matchPrefix: `${ACA_BASE}/homework`,
      },
      {
        key: 'account',
        label: 'Tai khoan',
        to: `${ACA_BASE}/account-security`,
        icon: ShieldCheck,
        matchPrefix: `${ACA_BASE}/account-security`,
      },
    ],
    subItems: [],
  },
};

const isTabActive = (tab, pathname) => {
  if (Array.isArray(tab.matchPrefix)) {
    return tab.matchPrefix.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }
  return pathname === tab.matchPrefix || pathname.startsWith(`${tab.matchPrefix}/`);
};

export default function MobileAppLayout({ variant = 'ielts' }) {
  const { pathname } = useLocation();
  const layout = MOBILE_LAYOUTS[variant] || MOBILE_LAYOUTS.ielts;
  const tabs = layout.tabs;
  const subItems = layout.subItems;

  const activeTabKey = useMemo(() => {
    for (const tab of tabs) {
      if (isTabActive(tab, pathname)) return tab.key;
    }
    return null;
  }, [pathname, tabs]);

  const showSubnav =
    Boolean(layout.subnavTabKey) &&
    activeTabKey === layout.subnavTabKey &&
    subItems.length > 0;

  return (
    <div className="mobile-app-shell">
      <header className="mobile-app-header">
        <span className="mobile-app-header__brand">{layout.brand}</span>
      </header>

      {showSubnav && (
        <nav className="mobile-app-subnav">
          {subItems.map((item) => {
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

      <main className="mobile-app-content">
        <div className="mobile-app-content__inner" key={pathname}>
          <Outlet />
        </div>
      </main>

      <nav className="mobile-tab-bar">
        {tabs.map((tab) => {
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
