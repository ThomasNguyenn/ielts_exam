import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedControllers = vi.hoisted(() => ({
  createHomeworkGroup: vi.fn((_req, res) => res.status(201).json({ route: "create-group" })),
  getHomeworkGroups: vi.fn((_req, res) => res.status(200).json({ route: "list-groups" })),
  getHomeworkGroupById: vi.fn((_req, res) => res.status(200).json({ route: "group-by-id" })),
  updateHomeworkGroup: vi.fn((_req, res) => res.status(200).json({ route: "update-group" })),
  deleteHomeworkGroup: vi.fn((_req, res) => res.status(200).json({ route: "delete-group" })),
  createHomeworkAssignment: vi.fn((_req, res) => res.status(201).json({ route: "create-assignment" })),
  getHomeworkAssignments: vi.fn((_req, res) => res.status(200).json({ route: "list-assignments" })),
  getHomeworkAssignmentById: vi.fn((_req, res) => res.status(200).json({ route: "assignment-by-id" })),
  updateHomeworkAssignment: vi.fn((_req, res) => res.status(200).json({ route: "update-assignment" })),
  patchHomeworkAssignmentOutline: vi.fn((_req, res) => res.status(200).json({ route: "patch-outline" })),
  getHomeworkAssignmentLessonById: vi.fn((_req, res) => res.status(200).json({ route: "get-lesson" })),
  patchHomeworkAssignmentLessonById: vi.fn((_req, res) => res.status(200).json({ route: "patch-lesson" })),
  updateHomeworkAssignmentStatus: vi.fn((_req, res) => res.status(200).json({ route: "update-status" })),
  deleteHomeworkAssignment: vi.fn((_req, res) => res.status(200).json({ route: "delete-assignment" })),
  uploadHomeworkAssignmentResource: vi.fn((_req, res) => res.status(200).json({ route: "upload-resource" })),
  getMyHomeworkAssignments: vi.fn((_req, res) => res.status(200).json({ route: "my-assignments" })),
  getMyHomeworkAssignmentById: vi.fn((_req, res) => res.status(200).json({ route: "my-assignment-by-id" })),
  upsertMyHomeworkTaskSubmission: vi.fn((_req, res) => res.status(200).json({ route: "my-submit-task" })),
  getHomeworkAssignmentDashboard: vi.fn((_req, res) => res.status(200).json({ route: "dashboard" })),
  getHomeworkTaskSubmissions: vi.fn((_req, res) => res.status(200).json({ route: "task-submissions" })),
  getHomeworkSubmissionById: vi.fn((_req, res) => res.status(200).json({ route: "submission-by-id" })),
  gradeHomeworkSubmission: vi.fn((_req, res) => res.status(200).json({ route: "grade-submission" })),
}));

vi.mock("../../controllers/homework.controller.js", () => mockedControllers);
vi.mock("../../services/objectStorage.service.js", () => ({
  getHomeworkAudioUploadLimitBytes: () => 50 * 1024 * 1024,
  getHomeworkImageMaxFiles: () => 5,
  getHomeworkImageUploadLimitBytes: () => 5 * 1024 * 1024,
  getHomeworkResourceUploadLimitBytes: () => 50 * 1024 * 1024,
}));
vi.mock("../../middleware/auth.middleware.js", () => ({
  verifyToken: (req, _res, next) => {
    req.user = {
      userId: "test-user",
      role: String(req.headers["x-test-role"] || "teacher"),
    };
    next();
  },
  isTeacherOrAdmin: (req, res, next) => {
    if (req.user?.role === "admin" || req.user?.role === "teacher") return next();
    return res.status(403).json({ success: false, message: "Forbidden: Access restricted to teacher/admin only" });
  },
}));

describe("homework routes role guards", () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: homeworkRoutes } = await import("../../routes/homework.route.js");
    app = express();
    app.use(express.json());
    app.use("/api/homework", homeworkRoutes);
  });

  it("allows teacher to access assignment list", async () => {
    const res = await request(app)
      .get("/api/homework/assignments")
      .set("x-test-role", "teacher");

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("list-assignments");
    expect(mockedControllers.getHomeworkAssignments).toHaveBeenCalledTimes(1);
  });

  it("allows teacher to patch assignment outline", async () => {
    const res = await request(app)
      .patch("/api/homework/assignments/a1/outline")
      .set("x-test-role", "teacher")
      .send({ sections: [] });

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("patch-outline");
    expect(mockedControllers.patchHomeworkAssignmentOutline).toHaveBeenCalledTimes(1);
  });

  it("rejects student on teacher/admin assignments route", async () => {
    const res = await request(app)
      .get("/api/homework/assignments")
      .set("x-test-role", "student");

    expect(res.status).toBe(403);
    expect(mockedControllers.getHomeworkAssignments).not.toHaveBeenCalled();
  });

  it("allows student to access /me route", async () => {
    const res = await request(app)
      .get("/api/homework/me")
      .set("x-test-role", "student");

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("my-assignments");
    expect(mockedControllers.getMyHomeworkAssignments).toHaveBeenCalledTimes(1);
  });

  it("rejects teacher on student /me route", async () => {
    const res = await request(app)
      .get("/api/homework/me")
      .set("x-test-role", "teacher");

    expect(res.status).toBe(403);
    expect(mockedControllers.getMyHomeworkAssignments).not.toHaveBeenCalled();
  });
});
