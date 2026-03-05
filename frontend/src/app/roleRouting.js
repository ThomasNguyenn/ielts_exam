export const USER_ROLE_LEGACY_STUDENT = 'student';
export const USER_ROLE_STUDENT_IELTS = 'studentIELTS';
export const USER_ROLE_STUDENT_ACA = 'studentACA';
export const USER_ROLE_TEACHER = 'teacher';
export const USER_ROLE_ADMIN = 'admin';

export const UI_ROLE_STUDENT_IELTS = USER_ROLE_STUDENT_IELTS;
export const UI_ROLE_STUDENT_ACA = USER_ROLE_STUDENT_ACA;
export const UI_ROLE_TEACHER = USER_ROLE_TEACHER;
export const UI_ROLE_ADMIN = USER_ROLE_ADMIN;

const ROLE_DEFAULT_PATH = {
  [UI_ROLE_STUDENT_IELTS]: '/student-ielts/learn',
  [UI_ROLE_STUDENT_ACA]: '/student-aca/homework',
  [UI_ROLE_TEACHER]: '/grading',
  [UI_ROLE_ADMIN]: '/admin/manage',
};

export const ADMIN_SWITCHABLE_UI_ROLES = [
  UI_ROLE_STUDENT_IELTS,
  UI_ROLE_STUDENT_ACA,
  UI_ROLE_ADMIN,
];

export const TEACHER_SWITCHABLE_UI_ROLES = [
  UI_ROLE_STUDENT_IELTS,
  UI_ROLE_STUDENT_ACA,
  UI_ROLE_TEACHER,
];

export const STUDENT_FAMILY_ROLES = [
  USER_ROLE_LEGACY_STUDENT,
  USER_ROLE_STUDENT_IELTS,
  USER_ROLE_STUDENT_ACA,
];

export const normalizeUserRole = (role) => {
  const normalized = String(role || '').trim();
  if (!normalized) return '';
  if (normalized === USER_ROLE_LEGACY_STUDENT) return USER_ROLE_STUDENT_IELTS;
  return normalized;
};

export const isStudentFamilyRole = (role) =>
  STUDENT_FAMILY_ROLES.includes(String(role || '').trim());

export const resolveAccessRolesForUserRole = (role) => {
  const normalized = normalizeUserRole(role);

  if (normalized === USER_ROLE_ADMIN) {
    return [UI_ROLE_ADMIN, UI_ROLE_TEACHER, UI_ROLE_STUDENT_IELTS, UI_ROLE_STUDENT_ACA];
  }

  if (normalized === USER_ROLE_TEACHER) {
    return [UI_ROLE_TEACHER, UI_ROLE_STUDENT_IELTS, UI_ROLE_STUDENT_ACA];
  }

  if (normalized === USER_ROLE_STUDENT_ACA) {
    return [UI_ROLE_STUDENT_ACA];
  }

  if (normalized === USER_ROLE_STUDENT_IELTS) {
    return [UI_ROLE_STUDENT_IELTS];
  }

  return [];
};

export const userHasAnyAllowedRole = (user, allowed = []) => {
  const effectiveRoles = resolveAccessRolesForUserRole(user?.role);
  return effectiveRoles.some((role) => allowed.includes(role));
};

export const isUnconfirmedStudentFamilyUser = (user) =>
  Boolean(user && isStudentFamilyRole(user.role) && !user.isConfirmed);

export const getDefaultRouteForRole = (role) => {
  const normalized = normalizeUserRole(role);
  return ROLE_DEFAULT_PATH[normalized] || '/login';
};

export const getDefaultRouteForUser = (user) => getDefaultRouteForRole(user?.role);

export const studentIeltsPath = (subPath = '') => {
  const safeSubPath = String(subPath || '').trim();
  if (!safeSubPath) return '/student-ielts';
  return safeSubPath.startsWith('/') ? `/student-ielts${safeSubPath}` : `/student-ielts/${safeSubPath}`;
};

export const studentAcaPath = (subPath = '') => {
  const safeSubPath = String(subPath || '').trim();
  if (!safeSubPath) return '/student-aca';
  return safeSubPath.startsWith('/') ? `/student-aca${safeSubPath}` : `/student-aca/${safeSubPath}`;
};

export const adminPath = (subPath = '') => {
  const safeSubPath = String(subPath || '').trim();
  if (!safeSubPath) return '/admin';
  return safeSubPath.startsWith('/') ? `/admin${safeSubPath}` : `/admin/${safeSubPath}`;
};

const LEGACY_PREFIX_REWRITE_RULES = [
  ['/manage', '/admin/manage'],
  ['/grading', '/grading'],
  ['/scores', '/scores'],
  ['/evaluate', '/evaluate'],
  ['/homework/my', '/student-ielts/homework'],
  ['/homework/assignments', '/homework/assignments'],
  ['/homework/groups', '/homework/groups'],
  ['/homework/submissions', '/homework/submissions'],
  ['/homework', '/homework'],
  ['/profile', '/student-ielts/profile'],
  ['/tests', '/student-ielts/tests'],
  ['/practice/speaking', '/student-ielts/speaking'],
  ['/practice', '/student-ielts/practice'],
  ['/speaking', '/student-ielts/speaking'],
  ['/learn', '/student-ielts/learn'],
  ['/analytics/student', '/analytics/student'],
  ['/analytics', '/student-ielts/analytics'],
  ['/vocabulary', '/student-ielts/vocabulary'],
  ['/achievements', '/student-ielts/achievements'],
  ['/study-plan', '/student-ielts/study-plan'],
];

export const toCanonicalAppPath = (rawPath = '') => {
  const input = String(rawPath || '').trim();
  if (!input || !input.startsWith('/')) return input;

  const [pathname = '', suffix = ''] = input.split(/([?#].*)/, 2);

  const rewriteRule = LEGACY_PREFIX_REWRITE_RULES.find(
    ([legacyPrefix]) =>
      pathname === legacyPrefix || pathname.startsWith(`${legacyPrefix}/`),
  );

  if (!rewriteRule) return input;
  const [legacyPrefix, canonicalPrefix] = rewriteRule;
  const nextPathname = pathname.replace(legacyPrefix, canonicalPrefix);
  return `${nextPathname}${suffix || ''}`;
};
