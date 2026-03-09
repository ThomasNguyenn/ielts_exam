export function resolveProtectedRouteRedirect({ isAuthenticated, user }) {
  if (!isAuthenticated || !user) {
    return '/login';
  }

  if (user?.role === 'student' && !user?.isConfirmed) {
    return '/wait-for-confirmation';
  }

  return null;
}

export function resolveManageRouteRedirect({ isAuthenticated, user }) {
  if (!isAuthenticated) {
    return '/';
  }

  if (!['teacher', 'admin'].includes(user?.role)) {
    return '/';
  }

  return null;
}

export function resolvePublicRouteRedirect({ isAuthenticated, user }) {
  if (!isAuthenticated || !user) {
    return null;
  }

  if (user?.role === 'student' && !user?.isConfirmed) {
    return '/wait-for-confirmation';
  }

  return '/';
}
