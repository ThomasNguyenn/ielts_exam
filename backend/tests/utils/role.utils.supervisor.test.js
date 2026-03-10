import { describe, expect, it } from "vitest";
import {
  INVITABLE_ROLE_VALUES,
  PROMOTABLE_ROLE_VALUES,
  ROLE_ADMIN,
  ROLE_SUPERVISOR,
  ROLE_TEACHER,
} from "../../utils/role.utils.js";

describe("role.utils supervisor enum support", () => {
  it("includes supervisor in promotable role values", () => {
    expect(PROMOTABLE_ROLE_VALUES).toContain(ROLE_SUPERVISOR);
  });

  it("keeps staff roles promotable", () => {
    expect(PROMOTABLE_ROLE_VALUES).toContain(ROLE_TEACHER);
    expect(PROMOTABLE_ROLE_VALUES).toContain(ROLE_ADMIN);
  });

  it("includes supervisor in invitable role values", () => {
    expect(INVITABLE_ROLE_VALUES).toContain(ROLE_SUPERVISOR);
  });
});
