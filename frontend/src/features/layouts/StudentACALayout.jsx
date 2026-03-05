import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import AssignmentTurnedInOutlined from '@mui/icons-material/AssignmentTurnedInOutlined';
import { api } from '@/shared/api/client';
import LevelProgress from '@/shared/components/LevelProgress';
import '@/shared/components/Navigation.css';
import '@/shared/components/Navigation-mobile.css';

export default function StudentACALayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [user, setUser] = useState(() => api.getUser());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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
              <span className="nav-item-text">Bai tap thang</span>
            </NavLink>

            <div className="nav-spacer desktop-only" />

            {user ? (
              <div className="nav-user-section">
                <LevelProgress user={user} />
                <button
                  type="button"
                  className="logout-btn"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  title="Logout"
                >
                  <LogOut className="nav-icon" />
                </button>
              </div>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
