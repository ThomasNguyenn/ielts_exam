import { describe, expect, it } from "vitest";
import {
  ADMIN_SWITCHABLE_UI_ROLES,
  UI_ROLE_ADMIN,
  UI_ROLE_STUDENT_ACA,
  UI_ROLE_STUDENT_IELTS,
  UI_ROLE_SUPERVISOR,
  USER_ROLE_SUPERVISOR,
  getDefaultRouteForRole,
  resolveAccessRolesForUserRole,
  userHasAnyAllowedRole,
} from "../src/app/roleRouting";

describe("roleRouting supervisor contracts", () => {
  it("maps supervisor default route to dashboard", () => {
    expect(getDefaultRouteForRole(USER_ROLE_SUPERVISOR)).toBe("/dashboard");
  });

  it("resolves supervisor to supervisor-only access role", () => {
    expect(resolveAccessRolesForUserRole(USER_ROLE_SUPERVISOR)).toEqual([UI_ROLE_SUPERVISOR]);
  });

  it("allows admin UI switcher to include supervisor role", () => {
    expect(ADMIN_SWITCHABLE_UI_ROLES).toContain(UI_ROLE_SUPERVISOR);
  });

  it("does not grant student or admin access by default", () => {
    const supervisorUser = { role: USER_ROLE_SUPERVISOR };
    expect(userHasAnyAllowedRole(supervisorUser, [UI_ROLE_SUPERVISOR])).toBe(true);
    expect(userHasAnyAllowedRole(supervisorUser, [UI_ROLE_STUDENT_IELTS])).toBe(false);
    expect(userHasAnyAllowedRole(supervisorUser, [UI_ROLE_STUDENT_ACA])).toBe(false);
    expect(userHasAnyAllowedRole(supervisorUser, [UI_ROLE_ADMIN])).toBe(false);
  });
});
