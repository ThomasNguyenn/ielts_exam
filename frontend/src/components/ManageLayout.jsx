import { Link, Outlet, useLocation } from 'react-router-dom';

export default function ManageLayout() {
  const location = useLocation();
  const base = '/manage';

  return (
    <div className="page manage-page">
      <h1>Manage content</h1>
      <nav className="manage-nav">
        <Link to={`${base}/passages`} className={location.pathname.startsWith(`${base}/passages`) ? 'active' : ''}>
          Passages (Reading)
        </Link>
        <Link to={`${base}/sections`} className={location.pathname.startsWith(`${base}/sections`) ? 'active' : ''}>
          Sections (Listening)
        </Link>
        <Link to={`${base}/tests`} className={location.pathname.startsWith(`${base}/tests`) ? 'active' : ''}>
          Tests
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
