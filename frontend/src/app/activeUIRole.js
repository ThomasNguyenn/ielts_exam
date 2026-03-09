import {
  ADMIN_SWITCHABLE_UI_ROLES,
  TEACHER_SWITCHABLE_UI_ROLES,
  normalizeUserRole,
  USER_ROLE_ADMIN,
  USER_ROLE_TEACHER,
} from './roleRouting.js';

const ACTIVE_UI_ROLE_KEY = 'activeUIRole';

const getStorage = () => {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const normalizeStoredRole = (value) => normalizeUserRole(String(value || '').trim());

export const getActiveUIRole = () => {
  const storage = getStorage();
  if (!storage) return '';
  return normalizeStoredRole(storage.getItem(ACTIVE_UI_ROLE_KEY));
};

export const setActiveUIRole = (role) => {
  const storage = getStorage();
  if (!storage) return;

  const normalized = normalizeStoredRole(role);
  if (!normalized) {
    storage.removeItem(ACTIVE_UI_ROLE_KEY);
    return;
  }

  storage.setItem(ACTIVE_UI_ROLE_KEY, normalized);
};

export const clearActiveUIRole = () => {
  const storage = getStorage();
  storage?.removeItem(ACTIVE_UI_ROLE_KEY);
};

export const sanitizeActiveUIRoleForUser = (user, requestedRole = '') => {
  const normalizedUserRole = normalizeUserRole(user?.role);
  const normalizedRequestedRole = normalizeStoredRole(requestedRole || getActiveUIRole());

  if (normalizedUserRole === USER_ROLE_ADMIN) {
    return ADMIN_SWITCHABLE_UI_ROLES.includes(normalizedRequestedRole)
      ? normalizedRequestedRole
      : USER_ROLE_ADMIN;
  }

  if (normalizedUserRole === USER_ROLE_TEACHER) {
    return TEACHER_SWITCHABLE_UI_ROLES.includes(normalizedRequestedRole)
      ? normalizedRequestedRole
      : USER_ROLE_TEACHER;
  }

  return normalizedUserRole;
};

export { ACTIVE_UI_ROLE_KEY };
