import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { api } from '@/shared/api/client';
import {
  getDefaultRouteForUser,
  isUnconfirmedStudentFamilyUser,
  userHasAnyAllowedRole,
} from './roleRouting';

export function RequireAuth({ children }) {
  const location = useLocation();
  const isAuthenticated = api.isAuthenticated();
  const user = api.getUser();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isUnconfirmedStudentFamilyUser(user)) {
    return <Navigate to="/wait-for-confirmation" replace />;
  }

  return children || <Outlet />;
}

export function RequireRole({ allow = [], children }) {
  const user = api.getUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!Array.isArray(allow) || allow.length === 0) {
    return children || <Outlet />;
  }

  if (!userHasAnyAllowedRole(user, allow)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return children || <Outlet />;
}

export function PublicRoute({ children }) {
  const isAuthenticated = api.isAuthenticated();
  const user = api.getUser();

  if (!isAuthenticated || !user) {
    return children;
  }

  if (isUnconfirmedStudentFamilyUser(user)) {
    return <Navigate to="/wait-for-confirmation" replace />;
  }

  return <Navigate to={getDefaultRouteForUser(user)} replace />;
}
