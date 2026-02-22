import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  BookOpen,
  Headphones,
  Pen,
  Mic,
  FileText,
  Layers,
  UserCheck,
  Users,
  MailPlus,
} from 'lucide-react';
import '../pages/Manage.css';

const manageNavItems = [
  { to: '/manage/passages', label: 'Manage Passages', Icon: BookOpen },
  { to: '/manage/sections', label: 'Manage Listening', Icon: Headphones },
  { to: '/manage/writings', label: 'Manage Writing Tasks', Icon: Pen },
  { to: '/manage/speaking', label: 'Manage Speaking Topics', Icon: Mic },
  { to: '/manage/tests', label: 'Manage Full Tests', Icon: FileText },
  { to: '/manage/skill-modules', label: 'Manage Skill Modules', Icon: Layers },
  { to: '/manage/requests', label: 'Approve Students', Icon: UserCheck },
  { to: '/manage/users', label: 'Manage Users', Icon: Users },
  { to: '/manage/invitations', label: 'Send Invitations', Icon: MailPlus },
];

export default function ManageLayout() {
  const location = useLocation();
  const isEditorRoute = /^\/manage\/(passages|sections|writings|speaking|tests)\/[^/]+$/.test(location.pathname);

  return (
    <div className={`manage-page ${isEditorRoute ? 'manage-page--editor' : ''}`}>
      {!isEditorRoute && (
        <aside className="manage-sidebar">
          <div className="manage-admin-head">
            <LayoutGrid className="manage-admin-head-icon" />
            <span>ADMIN PANEL</span>
          </div>

          <nav className="manage-nav">
            {manageNavItems.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `manage-nav-item ${isActive ? 'active' : ''}`}>
                <Icon className="manage-nav-icon" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
      )}
      <main className="manage-shell-content">
        <Outlet />
      </main>
    </div>
  );
}
