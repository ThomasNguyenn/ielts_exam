import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedControllers = vi.hoisted(() => ({
  getAllUsersWithLatestScores: vi.fn((_req, res) => res.status(200).json({ route: "scores" })),
  getUserAttempts: vi.fn((_req, res) => res.status(200).json({ route: "attempts" })),
  getPendingStudents: vi.fn((_req, res) => res.status(200).json({ route: "pending" })),
  getOnlineStudents: vi.fn((_req, res) => res.status(200).json({ route: "online-students" })),
  setStudentHomeroomTeacher: vi.fn((_req, res) => res.status(200).json({ route: "set-homeroom-teacher" })),
  repairStuckSpeakingSessions: vi.fn((_req, res) => res.status(200).json({ route: "repair-stuck" })),
  retrySpeakingErrorLogs: vi.fn((_req, res) => res.status(200).json({ route: "retry-error-logs" })),
  retryFailedSpeakingErrorLogsBulk: vi.fn((_req, res) => res.status(200).json({ route: "retry-failed-bulk" })),
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

  it("routes /students/:userId/homeroom-teacher to setStudentHomeroomTeacher for admin", async () => {
    const res = await request(app)
      .put("/api/admin/students/507f1f77bcf86cd799439011/homeroom-teacher")
      .set("x-test-role", "admin")
      .send({ homeroom_teacher_id: "507f1f77bcf86cd799439012" });

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("set-homeroom-teacher");
    expect(mockedControllers.setStudentHomeroomTeacher).toHaveBeenCalledTimes(1);
  });

  it("rejects teacher on /students/:userId/homeroom-teacher (admin-only)", async () => {
    const res = await request(app)
      .put("/api/admin/students/507f1f77bcf86cd799439011/homeroom-teacher")
      .set("x-test-role", "teacher")
      .send({ homeroom_teacher_id: "507f1f77bcf86cd799439012" });

    expect(res.status).toBe(403);
    expect(mockedControllers.setStudentHomeroomTeacher).not.toHaveBeenCalled();
  });

  it("rejects teacher on /students/online (admin-only)", async () => {
    const res = await request(app)
      .get("/api/admin/students/online")
      .set("x-test-role", "teacher");

    expect(res.status).toBe(403);
    expect(mockedControllers.getOnlineStudents).not.toHaveBeenCalled();
  });

  it("routes /speaking/sessions/repair-stuck to repair controller for admin", async () => {
    const res = await request(app)
      .post("/api/admin/speaking/sessions/repair-stuck")
      .set("x-test-role", "admin")
      .send({ dry_run: true });

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("repair-stuck");
    expect(mockedControllers.repairStuckSpeakingSessions).toHaveBeenCalledTimes(1);
  });

  it("rejects teacher on /speaking/sessions/repair-stuck (admin-only)", async () => {
    const res = await request(app)
      .post("/api/admin/speaking/sessions/repair-stuck")
      .set("x-test-role", "teacher")
      .send({ dry_run: true });

    expect(res.status).toBe(403);
    expect(mockedControllers.repairStuckSpeakingSessions).not.toHaveBeenCalled();
  });

  it("routes /speaking/sessions/:id/retry-error-logs to retry controller for admin", async () => {
    const res = await request(app)
      .post("/api/admin/speaking/sessions/507f1f77bcf86cd799439011/retry-error-logs")
      .set("x-test-role", "admin")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("retry-error-logs");
    expect(mockedControllers.retrySpeakingErrorLogs).toHaveBeenCalledTimes(1);
  });

  it("rejects teacher on /speaking/sessions/:id/retry-error-logs (admin-only)", async () => {
    const res = await request(app)
      .post("/api/admin/speaking/sessions/507f1f77bcf86cd799439011/retry-error-logs")
      .set("x-test-role", "teacher")
      .send({});

    expect(res.status).toBe(403);
    expect(mockedControllers.retrySpeakingErrorLogs).not.toHaveBeenCalled();
  });
});
