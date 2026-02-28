import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, LogIn, LogOut, Menu, UserPlus, X } from 'lucide-react';
import { api } from '@/shared/api/client';
import LevelProgress from './LevelProgress';
import './Navigation.css';
import './Navigation-mobile.css';

/**
 * @typedef {Object} NavItemConfig
 * @property {string} key
 * @property {string} to
 * @property {string} label
 * @property {'all'|'auth'|'teacher_admin'|'admin'} visibility
 * @property {(pathname: string) => boolean=} isActive
 */

/** @type {{ core: NavItemConfig[]; direct: NavItemConfig[]; more: NavItemConfig[]; workspace: NavItemConfig[] }} */
const NAV_SCHEMA = {
  core: [
    {
      key: 'home',
      to: '/',
      label: 'Trang chủ',
      visibility: 'all',
      isActive: (pathname) => pathname === '/',
    },
    {
      key: 'profile',
      to: '/profile',
      label: 'Dashboard',
      visibility: 'auth',
      isActive: (pathname) => pathname.startsWith('/profile'),
    },
    {
      key: 'tests',
      to: '/tests',
      label: 'Luyện thi',
      visibility: 'all',
      isActive: (pathname) => pathname === '/tests' || pathname.startsWith('/tests/'),
    },
    {
      key: 'writing',
      to: '/practice',
      label: 'Luyện viết',
      visibility: 'all',
      isActive: (pathname) => pathname.startsWith('/practice') && !pathname.includes('/speaking'),
    },
    {
      key: 'speaking',
      to: '/speaking',
      label: 'Luyện nói',
      visibility: 'all',
      isActive: (pathname) => pathname.includes('/speaking'),
    },
    {
      key: 'skills',
      to: '/learn',
      label: 'Lý thuyết',
      visibility: 'all',
      isActive: (pathname) => pathname.startsWith('/learn'),
    },
    {
      key: 'analytics',
      to: '/analytics',
      label: 'Phân tích sâu',
      visibility: 'auth',
      isActive: (pathname) => pathname.startsWith('/analytics'),
    },
  ],
  direct: [],
  more: [
    {
      key: 'vocabulary',
      to: '/vocabulary',
      label: 'Vocabulary',
      visibility: 'auth',
      isActive: (pathname) => pathname.startsWith('/vocabulary'),
    },
    {
      key: 'achievements',
      to: '/achievements',
      label: 'Thành tựu',
      visibility: 'auth',
      isActive: (pathname) => pathname.startsWith('/achievements'),
    },
  ],
  workspace: [
    {
      key: 'grading',
      to: '/grading',
      label: 'Chấm bài',
      visibility: 'teacher_admin',
      isActive: (pathname) => pathname.startsWith('/grading'),
    },
    {
      key: 'scores',
      to: '/scores',
      label: 'Kết quả',
      visibility: 'teacher_admin',
      isActive: (pathname) => pathname.startsWith('/scores'),
    },
    {
      key: 'manage',
      to: '/manage',
      label: 'Quản lý',
      visibility: 'admin',
      isActive: (pathname) => pathname.startsWith('/manage'),
    },
  ],
};

const isItemVisible = (item, user) => {
  if (item.visibility === 'all') return true;
  if (item.visibility === 'auth') return Boolean(user);
  if (item.visibility === 'teacher_admin') return user?.role === 'teacher' || user?.role === 'admin';
  if (item.visibility === 'admin') return user?.role === 'admin';
  return false;
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => api.getUser());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navContainerRef = useRef(null);
  const pathname = location.pathname;

  useEffect(() => {
    setUser(api.getUser());
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [location.pathname]);

  useEffect(() => {
    const syncUser = () => setUser(api.getUser());
    window.addEventListener('auth-user-updated', syncUser);
    return () => window.removeEventListener('auth-user-updated', syncUser);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!navContainerRef.current?.contains(event.target)) {
        setOpenDropdown(null);
        setIsMobileMenuOpen(false);
      }
    };

    const handleEscClose = (event) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscClose);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscClose);
    };
  }, []);

  // Hide header on exam pages.
  const isExamPage = pathname.includes('/exam');
  const isManageRoute = pathname.startsWith('/manage');
  const hideHeader = isExamPage;

  // Use wide layout for practice pages.
  const isPracticePage =
    pathname.includes('/practice') ||
    pathname.startsWith('/learn') ||
    pathname.startsWith('/speaking');
  // Use full width layout for manage pages and test list.
  const isManagePage = isManageRoute || pathname === '/tests' || pathname.startsWith('/scores');

  // Use full width layout for grading pages.
  const isGradingPage = pathname.startsWith('/grading');

  // Use wide layout for AI result pages.
  const isResultAiPage = pathname.includes('/result-ai');
  const isWritingLivePage = pathname.startsWith('/writing-live/');

  // Test detail pages (e.g. /tests/abc123 but not /tests or /tests/abc123/exam).
  const isTestDetailPage = /^\/tests\/[^/]+$/.test(pathname);

  // Profile page custom width.
  const isProfilePage = pathname.startsWith('/profile');
  const isAnalyticsPage = pathname.startsWith('/analytics');
  const isAchievementsPage = pathname.startsWith('/achievements');

  const coreItems = useMemo(
    () => NAV_SCHEMA.core.filter((item) => isItemVisible(item, user) && (item.key !== 'home' || !user)),
    [user],
  );
  const directItems = useMemo(
    () => NAV_SCHEMA.direct.filter((item) => isItemVisible(item, user)),
    [user],
  );
  const moreItems = useMemo(
    () => NAV_SCHEMA.more.filter((item) => isItemVisible(item, user)),
    [user],
  );
  const workspaceItems = useMemo(
    () => NAV_SCHEMA.workspace.filter((item) => isItemVisible(item, user)),
    [user],
  );

  const isMoreActive = moreItems.some((item) => item.isActive?.(pathname));
  const isWorkspaceActive = workspaceItems.some((item) => item.isActive?.(pathname));

  const closeAllMenus = () => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await api.logout();
    } finally {
      closeAllMenus();
      navigate('/login', { replace: true });
      setIsLoggingOut(false);
    }
  };

  const toggleDropdown = (menuKey) => {
    setOpenDropdown((prev) => (prev === menuKey ? null : menuKey));
  };

  const getNavLinkClassName = (item, isActiveFromRouter = false, extraClass = '') => {
    const active = typeof item.isActive === 'function' ? item.isActive(pathname) : isActiveFromRouter;
    return `nav-item ${active ? 'active' : ''} ${extraClass}`.trim();
  };

  return (
    <div className="layout">
      {!hideHeader && (
        <header className="layout-header">
          <div className="nav-container" ref={navContainerRef}>
            <div className="nav-mobile-head">
              <NavLink to="/" className="nav-mobile-brand" onClick={closeAllMenus}>
                IELTS MASTER
              </NavLink>
              <button
                type="button"
                className={`nav-toggle ${isMobileMenuOpen ? 'open' : ''}`}
                aria-label="Toggle navigation"
                aria-expanded={isMobileMenuOpen}
                aria-controls="layout-navigation"
                onClick={() => {
                  setOpenDropdown(null);
                  setIsMobileMenuOpen((prev) => !prev);
                }}
              >
                {isMobileMenuOpen ? <X className="nav-toggle-icon" /> : <Menu className="nav-toggle-icon" />}
              </button>
            </div>

            <nav id="layout-navigation" className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
              {coreItems.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) => getNavLinkClassName(item, isActive)}
                  onClick={closeAllMenus}
                >
                  {item.label}
                </NavLink>
              ))}
              {directItems.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) => getNavLinkClassName(item, isActive)}
                  onClick={closeAllMenus}
                >
                  {item.label}
                </NavLink>
              ))}

              <div className="nav-spacer desktop-only" />

              {moreItems.length > 0 && (
                <>
                  <div className={`nav-dropdown desktop-only ${isMoreActive ? 'active' : ''}`}>
                    <button
                      type="button"
                      className={`nav-item nav-dropdown-trigger ${isMoreActive ? 'active' : ''}`}
                      aria-haspopup="menu"
                      aria-expanded={openDropdown === 'more'}
                      aria-controls="nav-more-menu"
                      onClick={() => toggleDropdown('more')}
                    >
                      Tiện ích
                      <ChevronDown className={`nav-dropdown-chevron ${openDropdown === 'more' ? 'rotated' : ''}`} />
                    </button>
                    <div
                      id="nav-more-menu"
                      role="menu"
                      className={`nav-dropdown-menu ${openDropdown === 'more' ? 'open' : ''}`}
                    >
                      {moreItems.map((item) => (
                        <NavLink
                          key={item.key}
                          to={item.to}
                          role="menuitem"
                          className={({ isActive }) => getNavLinkClassName(item, isActive, 'nav-dropdown-item')}
                          onClick={closeAllMenus}
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>

                  <div className="nav-mobile-section mobile-only">
                    <p className="nav-section-title">More</p>
                    {moreItems.map((item) => (
                      <NavLink
                        key={`mobile-${item.key}`}
                        to={item.to}
                        className={({ isActive }) => getNavLinkClassName(item, isActive)}
                        onClick={closeAllMenus}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}

              {workspaceItems.length > 0 && (
                <>
                  <div className={`nav-dropdown desktop-only ${isWorkspaceActive ? 'active' : ''}`}>
                    <button
                      type="button"
                      className={`nav-item nav-dropdown-trigger ${isWorkspaceActive ? 'active' : ''}`}
                      aria-haspopup="menu"
                      aria-expanded={openDropdown === 'workspace'}
                      aria-controls="nav-workspace-menu"
                      onClick={() => toggleDropdown('workspace')}
                    >
                      Workspace
                      <ChevronDown className={`nav-dropdown-chevron ${openDropdown === 'workspace' ? 'rotated' : ''}`} />
                    </button>
                    <div
                      id="nav-workspace-menu"
                      role="menu"
                      className={`nav-dropdown-menu ${openDropdown === 'workspace' ? 'open' : ''}`}
                    >
                      {workspaceItems.map((item) => (
                        <NavLink
                          key={item.key}
                          to={item.to}
                          role="menuitem"
                          className={({ isActive }) => getNavLinkClassName(item, isActive, 'nav-dropdown-item')}
                          onClick={closeAllMenus}
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>

                  <div className="nav-mobile-section mobile-only">
                    <p className="nav-section-title">Workspace</p>
                    {workspaceItems.map((item) => (
                      <NavLink
                        key={`mobile-${item.key}`}
                        to={item.to}
                        className={({ isActive }) => getNavLinkClassName(item, isActive)}
                        onClick={closeAllMenus}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}

              {user ? (
                <div className="nav-user-section">
                  <LevelProgress user={user} />
                  <button
                    type="button"
                    className="nav-item logout-btn"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    <LogOut className="nav-icon" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="nav-divider desktop-only" />
                  <NavLink to="/login" className={({ isActive }) => `nav-item btn-login ${isActive ? 'active' : ''}`} onClick={closeAllMenus}>
                    <LogIn className="nav-icon" /> Login
                  </NavLink>
                  <NavLink to="/register" className={({ isActive }) => `nav-item btn-register ${isActive ? 'active' : ''}`} onClick={closeAllMenus}>
                    <UserPlus className="nav-icon" /> Register
                  </NavLink>
                </>
              )}
            </nav>
          </div>
        </header>
      )}
      <main className={`layout-main ${isExamPage ? 'layout-main--fullscreen' : ''} ${isPracticePage || isTestDetailPage ? 'layout-main--wide' : ''} ${isResultAiPage ? 'layout-main--result-ai' : ''} ${isManagePage ? 'layout-main--manage' : ''} ${isGradingPage ? 'layout-main--grading' : ''} ${pathname === '/' ? 'layout-main--home' : ''} ${isProfilePage ? 'layout-main--profile' : ''} ${isAnalyticsPage ? 'layout-main--analytics' : ''} ${isAchievementsPage ? 'layout-main--achievements' : ''} ${isWritingLivePage ? 'layout-main--writing-live' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
