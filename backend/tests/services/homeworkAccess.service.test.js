import { describe, expect, it } from "vitest";
import {
  canGradeStudentForAssignment,
  canManageAssignment,
  isAssignmentOwner,
  resolveStudentAssignmentFilter,
} from "../../services/homeworkAccess.service.js";

describe("homeworkAccess.service", () => {
  it("isAssignmentOwner matches by creator id", () => {
    const assignment = { created_by: "507f1f77bcf86cd799439011" };
    expect(isAssignmentOwner(assignment, "507f1f77bcf86cd799439011")).toBe(true);
    expect(isAssignmentOwner(assignment, "507f1f77bcf86cd799439012")).toBe(false);
  });

  it("canManageAssignment allows admin and assignment owner", () => {
    const assignment = { created_by: "507f1f77bcf86cd799439011" };
    expect(canManageAssignment({ assignment, user: { userId: "x", role: "admin" } })).toBe(true);
    expect(
      canManageAssignment({
        assignment,
        user: { userId: "507f1f77bcf86cd799439011", role: "teacher" },
      }),
    ).toBe(true);
    expect(
      canManageAssignment({
        assignment,
        user: { userId: "507f1f77bcf86cd799439022", role: "teacher" },
      }),
    ).toBe(false);
  });

  it("canGradeStudentForAssignment allows teacher for their homeroom student", () => {
    const result = canGradeStudentForAssignment({
      assignment: { created_by: "507f1f77bcf86cd799439099" },
      student: { homeroom_teacher_id: "507f1f77bcf86cd799439001" },
      user: { userId: "507f1f77bcf86cd799439001", role: "teacher" },
    });
    expect(result.allowed).toBe(true);
  });

  it("canGradeStudentForAssignment allows teacher if student unassigned and assignment creator", () => {
    const result = canGradeStudentForAssignment({
      assignment: { created_by: "507f1f77bcf86cd799439001" },
      student: { homeroom_teacher_id: null },
      user: { userId: "507f1f77bcf86cd799439001", role: "teacher" },
    });
    expect(result.allowed).toBe(true);
  });

  it("canGradeStudentForAssignment rejects teacher outside grade scope", () => {
    const result = canGradeStudentForAssignment({
      assignment: { created_by: "507f1f77bcf86cd799439001" },
      student: { homeroom_teacher_id: "507f1f77bcf86cd799439777" },
      user: { userId: "507f1f77bcf86cd799439001", role: "teacher" },
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("HOMEWORK_FORBIDDEN_GRADE_SCOPE");
  });

  it("resolveStudentAssignmentFilter builds published filter with month and groups", () => {
    const filter = resolveStudentAssignmentFilter({
      studentGroupIds: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
      month: "2026-03",
    });

    expect(filter.status).toBe("published");
    expect(filter.month).toBe("2026-03");
    expect(Array.isArray(filter.target_group_ids.$in)).toBe(true);
    expect(filter.target_group_ids.$in).toHaveLength(2);
  });
});
