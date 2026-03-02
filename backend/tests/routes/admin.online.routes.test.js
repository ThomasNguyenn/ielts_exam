import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedControllers = vi.hoisted(() => ({
  getAllUsersWithLatestScores: vi.fn((_req, res) => res.status(200).json({ route: "scores" })),
  getUserAttempts: vi.fn((_req, res) => res.status(200).json({ route: "attempts" })),
  getPendingStudents: vi.fn((_req, res) => res.status(200).json({ route: "pending" })),
  getOnlineStudents: vi.fn((_req, res) => res.status(200).json({ route: "online-students" })),
  approveStudent: vi.fn((_req, res) => res.status(200).json({ route: "approve" })),
  getUsers: vi.fn((_req, res) => res.status(200).json({ route: "users" })),
  deleteUser: vi.fn((_req, res) => res.status(200).json({ route: "delete" })),
  changeUserRole: vi.fn((_req, res) => res.status(200).json({ route: "change-role" })),
  inviteUser: vi.fn((_req, res) => res.status(200).json({ route: "invite" })),
  getInvitations: vi.fn((_req, res) => res.status(200).json({ route: "invitations" })),
}));

vi.mock("../../controllers/admin.controller.js", () => mockedControllers);
vi.mock("../../middleware/auth.middleware.js", () => ({
  verifyToken: (req, _res, next) => {
    req.user = {
      userId: "test-user",
      role: String(req.headers["x-test-role"] || "admin"),
    };
    next();
  },
  isTeacherOrAdmin: (req, res, next) => {
    if (req.user?.role === "admin" || req.user?.role === "teacher") return next();
    return res.status(403).json({ success: false, message: "Forbidden: Access restricted to teacher/admin only" });
  },
  isAdmin: (req, res, next) => {
    if (req.user?.role === "admin") return next();
    return res.status(403).json({ success: false, message: "Forbidden: Admin access required" });
  },
}));

describe("admin online student routes", () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: adminRoutes } = await import("../../routes/admin.route.js");
    app = express();
    app.use("/api/admin", adminRoutes);
  });

  it("routes /students/online to getOnlineStudents for admin", async () => {
    const res = await request(app)
      .get("/api/admin/students/online")
      .set("x-test-role", "admin");

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("online-students");
    expect(mockedControllers.getOnlineStudents).toHaveBeenCalledTimes(1);
  });

  it("rejects teacher on /students/online (admin-only)", async () => {
    const res = await request(app)
      .get("/api/admin/students/online")
      .set("x-test-role", "teacher");

    expect(res.status).toBe(403);
    expect(mockedControllers.getOnlineStudents).not.toHaveBeenCalled();
  });
});
