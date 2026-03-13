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
  generateHomeworkQuizBlockByAI: vi.fn((req, res) => {
    if (!req.body?.prompt) return res.status(400).json({ route: "quiz-ai-generate", message: "prompt is required" });
    return res.status(200).json({ route: "quiz-ai-generate" });
  }),
  updateHomeworkAssignmentStatus: vi.fn((_req, res) => res.status(200).json({ route: "update-status" })),
  deleteHomeworkAssignment: vi.fn((_req, res) => res.status(200).json({ route: "delete-assignment" })),
  uploadHomeworkAssignmentResource: vi.fn((_req, res) => res.status(200).json({ route: "upload-resource" })),
  getMyHomeworkAssignments: vi.fn((_req, res) => res.status(200).json({ route: "my-assignments" })),
  getMyHomeworkAssignmentById: vi.fn((_req, res) => res.status(200).json({ route: "my-assignment-by-id" })),
  claimMyHomeworkChestReward: vi.fn((_req, res) => res.status(200).json({ route: "claim-chest-reward" })),
  launchMyHomeworkTaskTracking: vi.fn((_req, res) => res.status(200).json({ route: "launch-tracking" })),
  upsertMyHomeworkTaskSubmission: vi.fn((_req, res) => res.status(200).json({ route: "my-submit-task" })),
  getHomeworkAssignmentDashboard: vi.fn((_req, res) => res.status(200).json({ route: "dashboard" })),
  getHomeworkTaskSubmissions: vi.fn((_req, res) => res.status(200).json({ route: "task-submissions" })),
  getHomeworkSubmissionById: vi.fn((_req, res) => res.status(200).json({ route: "submission-by-id" })),
  generateHomeworkSectionAiReview: vi.fn((_req, res) => res.status(200).json({ route: "section-ai-review" })),
  generateHomeworkSubmissionAiReview: vi.fn((_req, res) => res.status(200).json({ route: "submission-ai-review" })),
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

  it("allows student to claim chest reward", async () => {
    const res = await request(app)
      .post("/api/homework/me/a1/rewards/chests/chest-3/claim")
      .set("x-test-role", "student");

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("claim-chest-reward");
    expect(mockedControllers.claimMyHomeworkChestReward).toHaveBeenCalledTimes(1);
  });

  it("rejects teacher on chest reward claim route", async () => {
    const res = await request(app)
      .post("/api/homework/me/a1/rewards/chests/chest-3/claim")
      .set("x-test-role", "teacher");

    expect(res.status).toBe(403);
    expect(mockedControllers.claimMyHomeworkChestReward).not.toHaveBeenCalled();
  });

  it("allows teacher to call quiz AI generate", async () => {
    const res = await request(app)
      .post("/api/homework/ai/quiz-block/generate")
      .set("x-test-role", "teacher")
      .send({ prompt: "Create 4 reading questions" });

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("quiz-ai-generate");
    expect(mockedControllers.generateHomeworkQuizBlockByAI).toHaveBeenCalledTimes(1);
  });

  it("rejects student on quiz AI generate route", async () => {
    const res = await request(app)
      .post("/api/homework/ai/quiz-block/generate")
      .set("x-test-role", "student")
      .send({ prompt: "Create 4 reading questions" });

    expect(res.status).toBe(403);
    expect(mockedControllers.generateHomeworkQuizBlockByAI).not.toHaveBeenCalled();
  });

  it("returns 400 when prompt is missing for quiz AI generate", async () => {
    const res = await request(app)
      .post("/api/homework/ai/quiz-block/generate")
      .set("x-test-role", "teacher")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.route).toBe("quiz-ai-generate");
    expect(mockedControllers.generateHomeworkQuizBlockByAI).toHaveBeenCalledTimes(1);
  });

  it("allows teacher to call submission AI review", async () => {
    const res = await request(app)
      .post("/api/homework/submissions/s1/ai-review")
      .set("x-test-role", "teacher")
      .send({ promptText: "frontend data should be ignored by backend" });

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("submission-ai-review");
    expect(mockedControllers.generateHomeworkSubmissionAiReview).toHaveBeenCalledTimes(1);
  });

  it("rejects student on submission AI review route", async () => {
    const res = await request(app)
      .post("/api/homework/submissions/s1/ai-review")
      .set("x-test-role", "student");

    expect(res.status).toBe(403);
    expect(mockedControllers.generateHomeworkSubmissionAiReview).not.toHaveBeenCalled();
  });

  it("allows teacher to call section AI review", async () => {
    const res = await request(app)
      .post("/api/homework/assignments/a1/sections/s1/ai-review")
      .set("x-test-role", "teacher")
      .send({ student_id: "u1" });

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("section-ai-review");
    expect(mockedControllers.generateHomeworkSectionAiReview).toHaveBeenCalledTimes(1);
  });

  it("rejects student on section AI review route", async () => {
    const res = await request(app)
      .post("/api/homework/assignments/a1/sections/s1/ai-review")
      .set("x-test-role", "student")
      .send({ student_id: "u1" });

    expect(res.status).toBe(403);
    expect(mockedControllers.generateHomeworkSectionAiReview).not.toHaveBeenCalled();
  });
});
