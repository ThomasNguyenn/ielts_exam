import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveManageRouteRedirect,
  resolveProtectedRouteRedirect,
  resolvePublicRouteRedirect,
} from "../src/app/routeGuards.js";

test("resolveProtectedRouteRedirect redirects anonymous users to /login", () => {
  const redirect = resolveProtectedRouteRedirect({
    isAuthenticated: false,
    user: null,
  });

  assert.equal(redirect, "/login");
});

test("resolveProtectedRouteRedirect redirects unconfirmed students to wait page", () => {
  const redirect = resolveProtectedRouteRedirect({
    isAuthenticated: true,
    user: { role: "student", isConfirmed: false },
  });

  assert.equal(redirect, "/wait-for-confirmation");
});

test("resolveProtectedRouteRedirect allows authenticated confirmed users", () => {
  const redirect = resolveProtectedRouteRedirect({
    isAuthenticated: true,
    user: { role: "student", isConfirmed: true },
  });

  assert.equal(redirect, null);
});

test("resolveManageRouteRedirect blocks non-admin/teacher access", () => {
  const redirect = resolveManageRouteRedirect({
    isAuthenticated: true,
    user: { role: "student" },
  });

  assert.equal(redirect, "/");
});

test("resolveManageRouteRedirect allows teacher/admin", () => {
  const teacherRedirect = resolveManageRouteRedirect({
    isAuthenticated: true,
    user: { role: "teacher" },
  });
  const adminRedirect = resolveManageRouteRedirect({
    isAuthenticated: true,
    user: { role: "admin" },
  });

  assert.equal(teacherRedirect, null);
  assert.equal(adminRedirect, null);
});

test("resolvePublicRouteRedirect redirects authenticated users", () => {
  const confirmedUserRedirect = resolvePublicRouteRedirect({
    isAuthenticated: true,
    user: { role: "student", isConfirmed: true },
  });
  const unconfirmedStudentRedirect = resolvePublicRouteRedirect({
    isAuthenticated: true,
    user: { role: "student", isConfirmed: false },
  });
  const anonymousRedirect = resolvePublicRouteRedirect({
    isAuthenticated: false,
    user: null,
  });

  assert.equal(confirmedUserRedirect, "/");
  assert.equal(unconfirmedStudentRedirect, "/wait-for-confirmation");
  assert.equal(anonymousRedirect, null);
});
