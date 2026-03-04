import mongoose from "mongoose";

const toIdString = (value) => String(value || "").trim();

export const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export const toObjectIdOrNull = (value) => {
  if (!isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
};

export const isTeacherOrAdminUser = (user = {}) =>
  user?.role === "teacher" || user?.role === "admin";

export const isAdminUser = (user = {}) => user?.role === "admin";

export const isAssignmentOwner = (assignment = {}, userId) => {
  const assignmentOwnerId = toIdString(assignment?.created_by);
  const requestUserId = toIdString(userId);
  return Boolean(assignmentOwnerId && requestUserId && assignmentOwnerId === requestUserId);
};

export const canManageAssignment = ({ assignment, user }) => {
  if (!user?.userId) return false;
  if (isAdminUser(user)) return true;
  return isAssignmentOwner(assignment, user.userId);
};

export const canGradeStudentForAssignment = ({ assignment, student, user }) => {
  if (!user?.userId || !user?.role) {
    return { allowed: false, code: "HOMEWORK_FORBIDDEN_GRADE_SCOPE" };
  }

  if (isAdminUser(user)) {
    return { allowed: true, code: null };
  }

  if (user.role !== "teacher") {
    return { allowed: false, code: "HOMEWORK_FORBIDDEN_GRADE_SCOPE" };
  }

  const teacherId = toIdString(user.userId);
  const studentHomeroomTeacherId = toIdString(student?.homeroom_teacher_id);
  if (studentHomeroomTeacherId && studentHomeroomTeacherId === teacherId) {
    return { allowed: true, code: null };
  }

  const isUnassignedStudent = !studentHomeroomTeacherId;
  if (isUnassignedStudent && isAssignmentOwner(assignment, teacherId)) {
    return { allowed: true, code: null };
  }

  return { allowed: false, code: "HOMEWORK_FORBIDDEN_GRADE_SCOPE" };
};

export const resolveStudentAssignmentFilter = ({ studentGroupIds = [], month = "" }) => {
  const groupIds = (Array.isArray(studentGroupIds) ? studentGroupIds : [])
    .map((value) => toObjectIdOrNull(value))
    .filter(Boolean);

  const filter = {
    status: "published",
    target_group_ids: { $in: groupIds },
  };

  const normalizedMonth = String(month || "").trim();
  if (normalizedMonth) {
    filter.month = normalizedMonth;
  }

  return filter;
};
