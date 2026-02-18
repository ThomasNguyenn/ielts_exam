import { NavLink, Outlet } from 'react-router-dom';
import '@/features/admin/pages/Manage.css';

const ManageIcons = {
  Reading: () => (
    <svg className="manage-nav-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
  ),
  Listening: () => (
    <svg className="manage-nav-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V8z" />
    </svg>
  ),
  Writing: () => (
    <svg className="manage-nav-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  ),
  Tests: () => (
    <svg className="manage-nav-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
  ),
  Speaking: () => (
    <svg className="manage-nav-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 2.34 9 4v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  ),
  Skills: () => (
    <svg className="manage-nav-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h11v12zM5 6H3v14c0 1.1.9 2 2 2h12v-2H5V6zm5 1h7v2h-7V7zm0 3h7v2h-7v-2zm0 3h4v2h-4v-2z" />
    </svg>
  )
};

export default function ManageLayout() {
  const base = '/manage';

  return (
    <div className="manage-page">
      <aside className="manage-sidebar">
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem 0.75rem',
          borderRadius: '0.85rem',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.02) 100%)'
        }}>
          <h2 style={{
            color: '#6366F1',
            fontSize: '1rem',
            marginBottom: '0.25rem',
            fontWeight: 800,
            letterSpacing: '-0.3px'
          }}>
            Quản lý hệ thống
          </h2>
          <p style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            fontWeight: 600,
            margin: 0
          }}>
            Admin Dashboard
          </p>
        </div>
        <nav className="manage-nav">
          <NavLink to={`${base}/passages`} className={({ isActive }) => `manage-nav-item ${isActive ? 'active' : ''}`}>
            <ManageIcons.Reading /> Quản lý Reading
          </NavLink>
          <NavLink to={`${base}/sections`} className={({ isActive }) => `manage-nav-item ${isActive ? 'active' : ''}`}>
            <ManageIcons.Listening /> Quản lý Listening
          </NavLink>
          <NavLink to={`${base}/speaking`} className={({ isActive }) => `manage-nav-item ${isActive ? 'active' : ''}`}>
            <ManageIcons.Speaking /> Quản lý Speaking
          </NavLink>
          <NavLink to={`${base}/writings`} className={({ isActive }) => `manage-nav-item ${isActive ? 'active' : ''}`}>
            <ManageIcons.Writing /> Quản lý Writing
          </NavLink>
          <NavLink to={`${base}/tests`} className={({ isActive }) => `manage-nav-item ${isActive ? 'active' : ''}`}>
            <ManageIcons.Tests /> Bộ đề (Full Tests)
          </NavLink>
          <NavLink to={`${base}/skill-modules`} className={({ isActive }) => `manage-nav-item ${isActive ? 'active' : ''}`}>
            <ManageIcons.Skills /> Manage Skill Modules
          </NavLink>
        </nav>
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
          <NavLink to="/manage/requests" className={({ isActive }) => `manage-nav-item ${isActive ? 'active' : ''}`}>
            <span style={{ fontSize: '1.2rem', marginRight: '0.75rem' }}>👥</span> Duyệt học viên
          </NavLink>
          <NavLink to="/manage/users" className={({ isActive }) => `manage-nav-item ${isActive ? 'active' : ''}`}>
            <span style={{ fontSize: '1.2rem', marginRight: '0.75rem' }}>⚙️</span> Quản lý User
          </NavLink>
        </div>
      </aside>
      <main className="manage-content">
        <Outlet />
      </main>
    </div>
  );
}
