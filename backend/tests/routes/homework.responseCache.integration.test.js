import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheStore = vi.hoisted(() => new Map());
const tagStore = vi.hoisted(() => new Map());
const counters = vi.hoisted(() => ({
  teacherList: 0,
  studentList: 0,
  dashboard: 0,
  taskSubmissions: 0,
}));

const cacheMocks = vi.hoisted(() => ({
  getJson: vi.fn(async (key) => cacheStore.get(key) || null),
  setJson: vi.fn(async (key, value) => {
    cacheStore.set(key, value);
    return true;
  }),
  addKeyToTags: vi.fn(async (key, tags = []) => {
    tags.forEach((tag) => {
      const normalizedTag = String(tag || "").trim();
      if (!normalizedTag) return;
      const bucket = tagStore.get(normalizedTag) || new Set();
      bucket.add(key);
      tagStore.set(normalizedTag, bucket);
    });
    return true;
  }),
  invalidateTags: vi.fn(async (tags = []) => {
    tags.forEach((tag) => {
      const normalizedTag = String(tag || "").trim();
      const keys = tagStore.get(normalizedTag);
      if (!keys) return;
      keys.forEach((cacheKey) => cacheStore.delete(cacheKey));
      tagStore.delete(normalizedTag);
    });
    return true;
  }),
}));

vi.mock("../../services/responseCache.redis.js", () => cacheMocks);

const homeworkControllerMocks = vi.hoisted(() => ({
  getHomeworkAssignments: vi.fn((req, res) => {
    counters.teacherList += 1;
    return res.status(200).json({
      success: true,
      version: counters.teacherList,
      data: [{ _id: "assign-1", month: req.query?.month || "all" }],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
  }),
  getMyHomeworkAssignments: vi.fn((req, res) => {
    counters.studentList += 1;
    return res.status(200).json({
      success: true,
      version: counters.studentList,
      user: String(req.user?.userId || ""),
      data: [{ _id: "assign-1", month: req.query?.month || "all" }],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
  }),
  getHomeworkAssignmentDashboard: vi.fn((_req, res) => {
    counters.dashboard += 1;
    return res.status(200).json({
      success: true,
      version: counters.dashboard,
      data: { assignment: { _id: "assign-1" }, tasks: [], students: [] },
    });
  }),
  getHomeworkTaskSubmissions: vi.fn((_req, res) => {
    counters.taskSubmissions += 1;
    return res.status(200).json({
      success: true,
      version: counters.taskSubmissions,
      data: { submissions: [], not_submitted_students: [] },
    });
  }),
  createHomeworkAssignment: vi.fn((_req, res) => res.status(201).json({ success: true })),
  upsertMyHomeworkTaskSubmission: vi.fn((_req, res) => res.status(200).json({ success: true })),
  gradeHomeworkSubmission: vi.fn((_req, res) => res.status(200).json({ success: true })),

  // Unused in this suite but required by route imports.
  createHomeworkGroup: vi.fn((_req, res) => res.status(201).json({ success: true })),
  getHomeworkGroups: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getHomeworkGroupById: vi.fn((_req, res) => res.status(200).json({ success: true })),
  updateHomeworkGroup: vi.fn((_req, res) => res.status(200).json({ success: true })),
  deleteHomeworkGroup: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getHomeworkAssignmentById: vi.fn((_req, res) => res.status(200).json({ success: true })),
  updateHomeworkAssignment: vi.fn((_req, res) => res.status(200).json({ success: true })),
  patchHomeworkAssignmentOutline: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getHomeworkAssignmentLessonById: vi.fn((_req, res) => res.status(200).json({ success: true })),
  patchHomeworkAssignmentLessonById: vi.fn((_req, res) => res.status(200).json({ success: true })),
  generateHomeworkQuizBlockByAI: vi.fn((_req, res) => res.status(200).json({ success: true })),
  updateHomeworkAssignmentStatus: vi.fn((_req, res) => res.status(200).json({ success: true })),
  deleteHomeworkAssignment: vi.fn((_req, res) => res.status(200).json({ success: true })),
  uploadHomeworkAssignmentResource: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getMyHomeworkAssignmentById: vi.fn((_req, res) => res.status(200).json({ success: true })),
  claimMyHomeworkChestReward: vi.fn((_req, res) => res.status(200).json({ success: true })),
  launchMyHomeworkTaskTracking: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getHomeworkSubmissionById: vi.fn((_req, res) => res.status(200).json({ success: true })),
}));

vi.mock("../../controllers/homework.controller.js", () => homeworkControllerMocks);

vi.mock("../../middleware/auth.middleware.js", () => ({
  verifyToken: (req, _res, next) => {
    req.user = {
      userId: String(req.headers["x-user-id"] || "teacher-1"),
      role: String(req.headers["x-user-role"] || "teacher"),
    };
    next();
  },
  isTeacherOrAdmin: (req, res, next) => {
    const role = String(req.user?.role || "").toLowerCase();
    if (role === "teacher" || role === "admin") return next();
    return res.status(403).json({ success: false, message: "Forbidden" });
  },
}));

describe("homework route response cache integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cacheStore.clear();
    tagStore.clear();
    counters.teacherList = 0;
    counters.studentList = 0;
    counters.dashboard = 0;
    counters.taskSubmissions = 0;
    process.env.API_RESPONSE_CACHE_ENABLED = "true";
    process.env.API_RESPONSE_CACHE_MAX_PAYLOAD_BYTES = "1048576";
  });

  it("caches and invalidates teacher assignment list", async () => {
    const { default: homeworkRoutes } = await import("../../routes/homework.route.js");
    const app = express();
    app.use(express.json());
    app.use("/api/homework", homeworkRoutes);

    const first = await request(app)
      .get("/api/homework/assignments?month=2026-03")
      .set("x-user-role", "teacher")
      .set("x-user-id", "teacher-1");
    expect(first.status).toBe(200);
    expect(first.headers["x-cache"]).toBe("MISS");
    expect(first.body.version).toBe(1);

    const second = await request(app)
      .get("/api/homework/assignments?month=2026-03")
      .set("x-user-role", "teacher")
      .set("x-user-id", "teacher-1");
    expect(second.status).toBe(200);
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(second.body.version).toBe(1);

    const write = await request(app)
      .post("/api/homework/assignments")
      .set("x-user-role", "teacher")
      .set("x-user-id", "teacher-1")
      .send({ title: "new assignment" });
    expect(write.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const third = await request(app)
      .get("/api/homework/assignments?month=2026-03")
      .set("x-user-role", "teacher")
      .set("x-user-id", "teacher-1");
    expect(third.status).toBe(200);
    expect(third.headers["x-cache"]).toBe("MISS");
    expect(third.body.version).toBe(2);
  });

  it("caches student monthly list per user and invalidates on submission", async () => {
    const { default: homeworkRoutes } = await import("../../routes/homework.route.js");
    const app = express();
    app.use(express.json());
    app.use("/api/homework", homeworkRoutes);

    const s1First = await request(app)
      .get("/api/homework/me?month=2026-03")
      .set("x-user-role", "student")
      .set("x-user-id", "student-1");
    expect(s1First.status).toBe(200);
    expect(s1First.headers["x-cache"]).toBe("MISS");
    expect(s1First.body.version).toBe(1);
    expect(s1First.body.user).toBe("student-1");

    const s1Second = await request(app)
      .get("/api/homework/me?month=2026-03")
      .set("x-user-role", "student")
      .set("x-user-id", "student-1");
    expect(s1Second.status).toBe(200);
    expect(s1Second.headers["x-cache"]).toBe("HIT");
    expect(s1Second.body.version).toBe(1);

    const s2First = await request(app)
      .get("/api/homework/me?month=2026-03")
      .set("x-user-role", "student")
      .set("x-user-id", "student-2");
    expect(s2First.status).toBe(200);
    expect(s2First.headers["x-cache"]).toBe("MISS");
    expect(s2First.body.version).toBe(2);
    expect(s2First.body.user).toBe("student-2");

    const submit = await request(app)
      .put("/api/homework/me/assign-1/tasks/task-1/submission")
      .set("x-user-role", "student")
      .set("x-user-id", "student-1")
      .field("text_answer", "draft");
    expect(submit.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const s1AfterSubmit = await request(app)
      .get("/api/homework/me?month=2026-03")
      .set("x-user-role", "student")
      .set("x-user-id", "student-1");
    expect(s1AfterSubmit.status).toBe(200);
    expect(s1AfterSubmit.headers["x-cache"]).toBe("MISS");
    expect(s1AfterSubmit.body.version).toBe(3);
  });

  it("caches dashboard and task submissions, invalidates after grading", async () => {
    const { default: homeworkRoutes } = await import("../../routes/homework.route.js");
    const app = express();
    app.use(express.json());
    app.use("/api/homework", homeworkRoutes);

    const dashboardFirst = await request(app)
      .get("/api/homework/assignments/assign-1/dashboard")
      .set("x-user-role", "teacher")
      .set("x-user-id", "teacher-1");
    expect(dashboardFirst.status).toBe(200);
    expect(dashboardFirst.headers["x-cache"]).toBe("MISS");
    expect(dashboardFirst.body.version).toBe(1);

    const dashboardSecond = await request(app)
      .get("/api/homework/assignments/assign-1/dashboard")
      .set("x-user-role", "teacher")
      .set("x-user-id", "teacher-1");
    expect(dashboardSecond.status).toBe(200);
    expect(dashboardSecond.headers["x-cache"]).toBe("HIT");
    expect(dashboardSecond.body.version).toBe(1);

    const taskFirst = await request(app)
      .get("/api/homework/assignments/assign-1/tasks/task-1/submissions")
      .set("x-user-role", "teacher")
      .set("x-user-id", "teacher-1");
    expect(taskFirst.status).toBe(200);
    expect(taskFirst.headers["x-cache"]).toBe("MISS");
    expect(taskFirst.body.version).toBe(1);

    const taskSecond = await request(app)
      .get("/api/homework/assignments/assign-1/tasks/task-1/submissions")
      .set("x-user-role", "teacher")
      .set("x-user-id", "teacher-1");
    expect(taskSecond.status).toBe(200);
    expect(taskSecond.headers["x-cache"]).toBe("HIT");
    expect(taskSecond.body.version).toBe(1);

    const grade = await request(app)
      .put("/api/homework/submissions/sub-1/grade")
      .set("x-user-role", "teacher")
      .set("x-user-id", "teacher-1")
      .send({ score: 8.5 });
    expect(grade.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const dashboardAfterGrade = await request(app)
      .get("/api/homework/assignments/assign-1/dashboard")
      .set("x-user-role", "teacher")
      .set("x-user-id", "teacher-1");
    expect(dashboardAfterGrade.status).toBe(200);
    expect(dashboardAfterGrade.headers["x-cache"]).toBe("MISS");
    expect(dashboardAfterGrade.body.version).toBe(2);

    const taskAfterGrade = await request(app)
      .get("/api/homework/assignments/assign-1/tasks/task-1/submissions")
      .set("x-user-role", "teacher")
      .set("x-user-id", "teacher-1");
    expect(taskAfterGrade.status).toBe(200);
    expect(taskAfterGrade.headers["x-cache"]).toBe("MISS");
    expect(taskAfterGrade.body.version).toBe(2);
  });
});

