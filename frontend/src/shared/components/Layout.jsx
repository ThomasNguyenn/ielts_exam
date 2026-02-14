import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '@/shared/api/client';
import Logout from './Logout';
import LevelProgress from './LevelProgress';
import './Navigation.css';

// Simple SVG Icons
// Colorful Icons matching the design
const Icons = {
  Home: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>,
  Elearning: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>,
  Skills: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" /></svg>,
  Writing: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>,
  Speaking: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 2.34 9 4v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>,
  Results: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>,
  Vocab: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" /></svg>,
  Profile: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>,
  Manage: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" /></svg>,
  Logout: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" /></svg>,
  Login: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" /></svg>,
  Register: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
};

export default function Layout() {
  const location = useLocation();
  const [user, setUser] = useState(() => api.getUser());

  useEffect(() => {
    setUser(api.getUser());
  }, [location.pathname]);

  // Hide header on exam pages for full-screen experience
  const isExamPage = location.pathname.includes('/exam');
  // Use wide layout for practice pages
  const isPracticePage = location.pathname.includes('/practice');
  // Use full width layout for manage pages and test list
  const isManagePage = location.pathname.includes('/manage') || location.pathname === '/tests';

  // Use wide layout for AI result pages
  const isResultAiPage = location.pathname.includes('/result-ai');

  return (
    <div className="layout">
      {!isExamPage && (
        <header className="layout-header">
          <div className="nav-container">
            {/* <NavLink to="/" className="nav-brand">
              IELTS MASTER
            </NavLink> */}

            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              Trang chủ
            </NavLink>

            <NavLink to="/tests" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              Luyện tập
            </NavLink>

            <NavLink to="/practice" className={() => `nav-item ${location.pathname.includes('/practice') && !location.pathname.includes('/speaking') ? 'active' : ''}`}>
              Luyện viết
            </NavLink>

            <NavLink to="/speaking" className={`nav-item ${location.pathname.includes('/speaking') ? 'active' : ''}`}>
              Luyện nói
            </NavLink>

            <div className="nav-spacer"></div>

            {user && (
              <>
                <NavLink to="/vocabulary" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  Vocabulary
                </NavLink>
                <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  Profile
                </NavLink>
                <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  Deep Analytics 📊
                </NavLink>
              </>
            )}

            {(user?.role === 'teacher' || user?.role === 'admin') && (
              <>
                <div className="nav-divider"></div>
                <NavLink to="/grading" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  Chấm Bài
                </NavLink>
                <NavLink to="/scores" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  Kết Quả
                </NavLink>
                <NavLink to="/manage" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  Quản Lý
                </NavLink>
              </>
            )}


            {user ? (
              <div className="nav-user-section" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <LevelProgress user={user} />
                <div className="nav-item logout-btn" style={{ cursor: 'pointer' }} onClick={() => {
                  api.removeToken();
                  api.removeUser();
                  window.location.href = '/login';
                }}>
                  <Icons.Logout />
                  {/* Logout <span className="user-badge">{user.name}</span> */}
                </div>
              </div>
            ) : (
              <>
                <div className="nav-divider"></div>
                <NavLink to="/login" className={({ isActive }) => `nav-item btn-login ${isActive ? 'active' : ''}`}>
                  <Icons.Login /> Login
                </NavLink>
                <NavLink to="/register" className={({ isActive }) => `nav-item btn-register ${isActive ? 'active' : ''}`}>
                  <Icons.Register /> Register
                </NavLink>
              </>
            )}
          </div>
        </header>
      )}
      <main className={`layout-main ${isExamPage ? 'layout-main--fullscreen' : ''} ${isPracticePage ? 'layout-main--wide' : ''} ${isResultAiPage ? 'layout-main--result-ai' : ''} ${isManagePage ? 'layout-main--manage' : ''} ${location.pathname === '/' ? 'layout-main--home' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
