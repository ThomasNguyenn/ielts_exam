import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, LogIn, LogOut, Menu, UserPlus, X } from 'lucide-react';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import LibraryBooksOutlined from '@mui/icons-material/LibraryBooksOutlined';
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined';
import RecordVoiceOverOutlined from '@mui/icons-material/RecordVoiceOverOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import AnalyticsOutlined from '@mui/icons-material/AnalyticsOutlined';
import TranslateOutlined from '@mui/icons-material/TranslateOutlined';
import MilitaryTechOutlined from '@mui/icons-material/MilitaryTechOutlined';
import GradingOutlined from '@mui/icons-material/GradingOutlined';
import LeaderboardOutlined from '@mui/icons-material/LeaderboardOutlined';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import RateReviewOutlined from '@mui/icons-material/RateReviewOutlined';
import AppsOutlined from '@mui/icons-material/AppsOutlined';
import WorkspacesOutlined from '@mui/icons-material/WorkspacesOutlined';
import AssignmentTurnedInOutlined from '@mui/icons-material/AssignmentTurnedInOutlined';
import { api } from '@/shared/api/client';
import { isStudentFamilyRole } from '@/app/roleRouting';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import LevelProgress from './LevelProgress';
import './Navigation.css';
import './Navigation-mobile.css';

/**
 * @typedef {Object} NavItemConfig
 * @property {string} key
 * @property {string} to
 * @property {string} label
 * @property {string=} icon
 * @property {'all'|'auth'|'teacher_admin'|'admin'|'student'} visibility
 * @property {(pathname: string) => boolean=} isActive
 */

/** @type {{ core: NavItemConfig[]; direct: NavItemConfig[]; more: NavItemConfig[]; workspace: NavItemConfig[] }} */
const NAV_SCHEMA = {
  core: [
    {
      key: 'home',
      to: '/',
      label: 'Trang chủ',
      icon: 'home',
      visibility: 'all',
      isActive: (pathname) => pathname === '/',
    },
    {
      key: 'profile',
      to: '/student-ielts/profile',
      label: 'Dashboard',
      icon: 'space_dashboard',
      visibility: 'auth',
      isActive: (pathname) => pathname.startsWith('/student-ielts/profile'),
    },
    {
      key: 'tests',
      to: '/student-ielts/tests',
      label: 'Luyện thi',
      icon: 'library_books',
      visibility: 'all',
      isActive: (pathname) => pathname === '/student-ielts/tests' || pathname.startsWith('/student-ielts/tests/'),
    },
    {
      key: 'writing',
      to: '/student-ielts/practice',
      label: 'Luyện viết',
      icon: 'edit_square',
      visibility: 'all',
      isActive: (pathname) => pathname.startsWith('/student-ielts/practice') && !pathname.includes('/student-ielts/speaking'),
    },
    {
      key: 'speaking',
      to: '/student-ielts/speaking',
      label: 'Luyện nói',
      icon: 'record_voice_over',
      visibility: 'all',
      isActive: (pathname) => pathname.includes('/student-ielts/speaking'),
    },
    {
      key: 'skills',
      to: '/student-ielts/learn',
      label: 'Lý thuyết',
      icon: 'menu_book',
      visibility: 'all',
      isActive: (pathname) => pathname.startsWith('/student-ielts/learn'),
    },
    {
      key: 'student_homework',
      to: '/student-ielts/homework',
      label: 'Bài tập tháng',
      icon: 'assignment',
      visibility: 'student',
      isActive: (pathname) => pathname.startsWith('/student-ielts/homework'),
    },
  ],
  direct: [],
  more: [
    {
      key: 'analytics',
      to: '/student-ielts/analytics',
      label: 'Phân tích sâu',
      icon: 'analytics',
      visibility: 'auth',
      isActive: (pathname) => pathname.startsWith('/student-ielts/analytics'),
    },
    {
      key: 'vocabulary',
      to: '/student-ielts/vocabulary',
      label: 'Vocabulary',
      icon: 'translate',
      visibility: 'auth',
      isActive: (pathname) => pathname.startsWith('/student-ielts/vocabulary'),
    },
    {
      key: 'achievements',
      to: '/student-ielts/achievements',
      label: 'Thành tựu',
      icon: 'military_tech',
      visibility: 'auth',
      isActive: (pathname) => pathname.startsWith('/student-ielts/achievements'),
    },
  ],
  workspace: [
    {
      key: 'grading',
      to: '/grading',
      label: 'Chấm bài',
      icon: 'grading',
      visibility: 'teacher_admin',
      isActive: (pathname) => pathname.startsWith('/grading'),
    },
    {
      key: 'scores',
      to: '/scores',
      label: 'Kết quả',
      icon: 'leaderboard',
      visibility: 'teacher_admin',
      isActive: (pathname) => pathname.startsWith('/scores'),
    },
    {
      key: 'evaluate',
      to: '/evaluate',
      label: 'Nhận Xét',
      icon: 'send',
      visibility: 'teacher_admin',
      isActive: (pathname) => pathname.startsWith('/evaluate'),
    },
    {
      key: 'homework',
      to: '/homework',
      label: 'Bài tập tháng',
      icon: 'assignment',
      visibility: 'teacher_admin',
      isActive: (pathname) => pathname.startsWith('/homework'),
    },
    {
      key: 'manage',
      to: '/admin/manage',
      label: 'Quản lý',
      icon: 'admin_panel_settings',
      visibility: 'admin',
      isActive: (pathname) => pathname.startsWith('/admin/manage'),
    },
  ],
};

const NAV_ICON_COMPONENTS = {
  home: HomeOutlined,
  space_dashboard: SpaceDashboardOutlined,
  library_books: LibraryBooksOutlined,
  edit_square: EditNoteOutlined,
  record_voice_over: RecordVoiceOverOutlined,
  menu_book: MenuBookOutlined,
  analytics: AnalyticsOutlined,
  translate: TranslateOutlined,
  military_tech: MilitaryTechOutlined,
  grading: GradingOutlined,
  leaderboard: LeaderboardOutlined,
  admin_panel_settings: AdminPanelSettingsOutlined,
  send: RateReviewOutlined,
  assignment: AssignmentTurnedInOutlined,
};

const isItemVisible = (item, user) => {
  if (item.visibility === 'all') return true;
  if (item.visibility === 'auth') return Boolean(user);
  if (item.visibility === 'teacher_admin') return user?.role === 'teacher' || user?.role === 'admin';
  if (item.visibility === 'admin') return user?.role === 'admin';
  if (item.visibility === 'student') return isStudentFamilyRole(user?.role);
  return false;
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => api.getUser());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
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

  // Hide header on exam and homework pages.
  const isExamPage = pathname.includes('/exam');
  const isHomeworkPage = pathname.startsWith('/homework');
  const isManageRoute = pathname.startsWith('/admin/manage');
  const hideHeader = isExamPage || isHomeworkPage;

  // Use wide layout for practice pages.
  const isPracticePage =
    pathname.includes('/student-ielts/practice') ||
    pathname.startsWith('/student-ielts/learn') ||
    pathname.startsWith('/student-ielts/speaking');
  // Use full width layout for manage pages and test list.
  const isManagePage = isManageRoute || pathname === '/student-ielts/tests' || pathname.startsWith('/scores') || pathname.startsWith('/evaluate') || pathname.startsWith('/homework');

  // Use full width layout for grading pages.
  const isGradingPage = pathname.startsWith('/grading');

  // Use wide layout for AI result pages.
  const isResultAiPage = pathname.includes('/result-ai');
  const isWritingLivePage = pathname.startsWith('/writing-live/');

  // Test detail pages (e.g. /student-ielts/tests/abc123 but not /student-ielts/tests or /student-ielts/tests/abc123/exam).
  const isTestDetailPage = /^\/student-ielts\/tests\/[^/]+$/.test(pathname);
  const isTestHistoryPage = /^\/student-ielts\/tests\/[^/]+\/history$/.test(pathname);

  // Profile page custom width.
  const isProfilePage = pathname.startsWith('/student-ielts/profile');
  const isAnalyticsPage = pathname.startsWith('/student-ielts/analytics');
  const isAchievementsPage = pathname.startsWith('/student-ielts/achievements');

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

  const requestLogout = () => {
    if (isLoggingOut) return;
    setIsLogoutDialogOpen(true);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await api.logout();
    } finally {
      closeAllMenus();
      setIsLogoutDialogOpen(false);
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
  const renderNavLabel = (item) => {
    const IconComponent = item.icon ? NAV_ICON_COMPONENTS[item.icon] : null;
    return (
      <>
        {IconComponent ? <IconComponent className="nav-item-symbol" aria-hidden="true" fontSize="inherit" /> : null}
        <span className="nav-item-text">{item.label}</span>
      </>
    );
  };

  return (
    <div className="layout">
      {!hideHeader && (
        <header className="layout-header">
          <div className="nav-container" ref={navContainerRef}>
            <div className="nav-mobile-head">
              <NavLink to="/" className="nav-mobile-brand" onClick={closeAllMenus}>
                <span className="nav-brand-text">IELTS MASTER</span>
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
                  {renderNavLabel(item)}
                </NavLink>
              ))}
              {directItems.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) => getNavLinkClassName(item, isActive)}
                  onClick={closeAllMenus}
                >
                  {renderNavLabel(item)}
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
                      <AppsOutlined className="nav-item-symbol" aria-hidden="true" fontSize="inherit" />
                      <span className="nav-item-text">Tiện ích</span>
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
                          {renderNavLabel(item)}
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
                        {renderNavLabel(item)}
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
                      <WorkspacesOutlined className="nav-item-symbol" aria-hidden="true" fontSize="inherit" />
                      <span className="nav-item-text">Workspace</span>
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
                          {renderNavLabel(item)}
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
                        {renderNavLabel(item)}
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
                    className="logout-btn"
                    onClick={requestLogout}
                    disabled={isLoggingOut}
                    title="Log out"
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
      <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out of this account?</AlertDialogTitle>
            <AlertDialogDescription>
              You can sign in again at any time. Unsaved actions may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" />
                  Logging out...
                </>
              ) : (
                'Log out'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <main className={`layout-main ${isExamPage ? 'layout-main--fullscreen' : ''} ${isPracticePage || isTestDetailPage || isTestHistoryPage ? 'layout-main--wide' : ''} ${isResultAiPage ? 'layout-main--result-ai' : ''} ${isManagePage ? 'layout-main--manage' : ''} ${isGradingPage ? 'layout-main--grading' : ''} ${pathname === '/' ? 'layout-main--home' : ''} ${isProfilePage ? 'layout-main--profile' : ''} ${isAnalyticsPage ? 'layout-main--analytics' : ''} ${isAchievementsPage ? 'layout-main--achievements' : ''} ${isWritingLivePage ? 'layout-main--writing-live' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}


