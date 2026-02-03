import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/" className="layout-brand">
          IELTS Exam
        </Link>
        <nav className="layout-nav">
          <Link to="/">Home</Link>
          <Link to="/tests">Tests</Link>
          <Link to="/manage">Manage</Link>
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
