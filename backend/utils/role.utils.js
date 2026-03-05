export const ROLE_STUDENT = 'student';
export const ROLE_STUDENT_IELTS = 'studentIELTS';
export const ROLE_STUDENT_ACA = 'studentACA';
export const ROLE_TEACHER = 'teacher';
export const ROLE_ADMIN = 'admin';

export const STUDENT_ROLE_VALUES = [
  ROLE_STUDENT,
  ROLE_STUDENT_IELTS,
  ROLE_STUDENT_ACA,
];

export const PROMOTABLE_ROLE_VALUES = [
  ROLE_STUDENT,
  ROLE_STUDENT_IELTS,
  ROLE_STUDENT_ACA,
  ROLE_TEACHER,
  ROLE_ADMIN,
];

export const INVITABLE_ROLE_VALUES = [ROLE_TEACHER, ROLE_ADMIN];

export const isStudentRole = (role) => STUDENT_ROLE_VALUES.includes(String(role || '').trim());

export const resolveStudentRoleFromStudyTrack = (studyTrack) => {
  const normalized = String(studyTrack || '').trim().toLowerCase();
  if (normalized === 'ielts') return ROLE_STUDENT_IELTS;
  if (normalized === 'aca') return ROLE_STUDENT_ACA;
  return '';
};
