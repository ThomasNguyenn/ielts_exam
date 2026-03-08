import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Loader2, LogOut, Menu, X } from 'lucide-react';
import AssignmentTurnedInOutlined from '@mui/icons-material/AssignmentTurnedInOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';
import { api } from '@/shared/api/client';
import MobileAppLayout from './MobileAppLayout';
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
import LevelProgress from '@/shared/components/LevelProgress';
import '@/shared/components/Navigation.css';
import '@/shared/components/Navigation-mobile.css';

const MOBILE_QUERY = '(max-width: 768px)';

export default function StudentACALayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });
  const [user, setUser] = useState(() => api.getUser());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const navContainerRef = useRef(null);

  useEffect(() => {
    setUser(api.getUser());
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const syncUser = () => setUser(api.getUser());
    window.addEventListener('auth-user-updated', syncUser);
    return () => window.removeEventListener('auth-user-updated', syncUser);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (event) => setIsMobile(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!navContainerRef.current?.contains(event.target)) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleEscClose = (event) => {
      if (event.key === 'Escape') {
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

  const closeAllMenus = () => {
    setIsMobileMenuOpen(false);
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

  if (isMobile) return <MobileAppLayout variant="aca" />;

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="nav-container" ref={navContainerRef}>
          <div className="nav-mobile-head">
            <NavLink to="/student-aca/homework" className="nav-mobile-brand" onClick={closeAllMenus}>
              <span className="nav-brand-text">ACA MASTER</span>
            </NavLink>
            <button
              type="button"
              className={`nav-toggle ${isMobileMenuOpen ? 'open' : ''}`}
              aria-label="Toggle navigation"
              aria-expanded={isMobileMenuOpen}
              aria-controls="student-aca-navigation"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              {isMobileMenuOpen ? <X className="nav-toggle-icon" /> : <Menu className="nav-toggle-icon" />}
            </button>
          </div>

          <nav id="student-aca-navigation" className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
            <NavLink
              to="/student-aca/homework"
              className={() => `nav-item ${pathname.startsWith('/student-aca/homework') ? 'active' : ''}`.trim()}
              onClick={closeAllMenus}
            >
              <AssignmentTurnedInOutlined className="nav-item-symbol" aria-hidden="true" fontSize="inherit" />
              <span className="nav-item-text">Bài tập tháng</span>
            </NavLink>

            <NavLink
              to="/student-aca/account-security"
              className={() => `nav-item ${pathname.startsWith('/student-aca/account-security') ? 'active' : ''}`.trim()}
              onClick={closeAllMenus}
            >
              <ManageAccountsOutlined className="nav-item-symbol" aria-hidden="true" fontSize="inherit" />
              <span className="nav-item-text">Settings</span>
            </NavLink>

            <div className="nav-spacer desktop-only" />

            {user ? (
              <div className="nav-user-section">
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
            ) : null}
          </nav>
        </div>
      </header>

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

      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
