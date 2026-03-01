import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheStore = vi.hoisted(() => new Map());
const tagStore = vi.hoisted(() => new Map());
const counters = vi.hoisted(() => ({
  testsCatalog: 0,
  writingsCatalog: 0,
  skillsModules: 0,
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
      const set = tagStore.get(normalizedTag) || new Set();
      set.add(key);
      tagStore.set(normalizedTag, set);
    });
    return true;
  }),
  invalidateTags: vi.fn(async (tags = []) => {
    tags.forEach((tag) => {
      const normalizedTag = String(tag || "").trim();
      const set = tagStore.get(normalizedTag);
      if (!set) return;
      set.forEach((cacheKey) => cacheStore.delete(cacheKey));
      tagStore.delete(normalizedTag);
    });
    return true;
  }),
}));

vi.mock("../../services/responseCache.redis.js", () => cacheMocks);

const testControllerMocks = vi.hoisted(() => ({
  getAllTests: vi.fn((_req, res) => {
    counters.testsCatalog += 1;
    return res.status(200).json({ success: true, version: counters.testsCatalog });
  }),
  getTestCategories: vi.fn((_req, res) => res.status(200).json({ success: true, data: [] })),
  createTest: vi.fn((_req, res) => res.status(201).json({ success: true })),
  updateTest: vi.fn((_req, res) => res.status(200).json({ success: true })),
  deleteTest: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getTheTestById: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getExamData: vi.fn((_req, res) => res.status(200).json({ success: true })),
  submitExam: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getMyLatestAttempts: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getMyAttemptSummary: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getMyTestAttempts: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getMyAttemptResult: vi.fn((_req, res) => res.status(200).json({ success: true })),
  renumberTestQuestions: vi.fn((_req, res) => res.status(200).json({ success: true })),
}));
vi.mock("../../controllers/test.controller.js", () => testControllerMocks);

const writingControllerMocks = vi.hoisted(() => ({
  archiveSubmission: vi.fn((_req, res) => res.status(200).json({ success: true })),
  closeLiveRoom: vi.fn((_req, res) => res.status(200).json({ success: true })),
  createSubmissionLiveRoom: vi.fn((_req, res) => res.status(200).json({ success: true })),
  createWriting: vi.fn((_req, res) => res.status(201).json({ success: true })),
  deleteWriting: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getAllWritings: vi.fn((_req, res) => {
    counters.writingsCatalog += 1;
    return res.status(200).json({ success: true, version: counters.writingsCatalog });
  }),
  getLiveRoomSharedContext: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getSubmissionById: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getSubmissionStudents: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getSubmissionStatus: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getSubmissions: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getWritingById: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getWritingExam: vi.fn((_req, res) => res.status(200).json({ success: true })),
  regenerateWritingId: vi.fn((_req, res) => res.status(200).json({ success: true })),
  resolveLiveRoom: vi.fn((_req, res) => res.status(200).json({ success: true })),
  scoreSubmission: vi.fn((_req, res) => res.status(200).json({ success: true })),
  scoreSubmissionAIFast: vi.fn((_req, res) => res.status(200).json({ success: true })),
  scoreSubmissionAI: vi.fn((_req, res) => res.status(200).json({ success: true })),
  submitWriting: vi.fn((_req, res) => res.status(200).json({ success: true })),
  updateWriting: vi.fn((_req, res) => res.status(200).json({ success: true })),
  uploadImage: vi.fn((_req, res) => res.status(200).json({ success: true })),
}));
vi.mock("../../controllers/writing.controller.js", () => writingControllerMocks);

const skillsControllerMocks = vi.hoisted(() => ({
  getCategories: vi.fn((_req, res) => res.status(200).json({ success: true, data: [] })),
  getAllModules: vi.fn((_req, res) => {
    counters.skillsModules += 1;
    return res.status(200).json({ success: true, version: counters.skillsModules });
  }),
  getModuleById: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getAllModulesForManage: vi.fn((_req, res) => res.status(200).json({ success: true })),
  reorderModules: vi.fn((_req, res) => res.status(200).json({ success: true })),
  getModuleByIdForManage: vi.fn((_req, res) => res.status(200).json({ success: true })),
  createModule: vi.fn((_req, res) => res.status(201).json({ success: true })),
  updateModule: vi.fn((_req, res) => res.status(200).json({ success: true })),
  deleteModule: vi.fn((_req, res) => res.status(200).json({ success: true })),
  completeModule: vi.fn((_req, res) => res.status(200).json({ success: true })),
  submitQuiz: vi.fn((_req, res) => res.status(200).json({ success: true })),
}));
vi.mock("../../controllers/skills.controller.js", () => skillsControllerMocks);

vi.mock("../../middleware/auth.middleware.js", () => ({
  verifyToken: (req, _res, next) => {
    req.user = { userId: "student-1", role: "student" };
    next();
  },
  optionalVerifyToken: (req, _res, next) => {
    req.user = { userId: "student-1", role: "student" };
    next();
  },
  isTeacherOrAdmin: (_req, _res, next) => next(),
}));

describe("response cache route integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cacheStore.clear();
    tagStore.clear();
    counters.testsCatalog = 0;
    counters.writingsCatalog = 0;
    counters.skillsModules = 0;
    process.env.API_RESPONSE_CACHE_ENABLED = "true";
    process.env.API_RESPONSE_CACHE_MAX_PAYLOAD_BYTES = "1048576";
  });

  it("applies cache + invalidation for /api/tests", async () => {
    const { default: testRoutes } = await import("../../routes/test.route.js");
    const app = express();
    app.use(express.json());
    app.use("/api/tests", testRoutes);

    const first = await request(app).get("/api/tests");
    expect(first.status).toBe(200);
    expect(first.headers["x-cache"]).toBe("MISS");
    expect(first.body.version).toBe(1);

    const second = await request(app).get("/api/tests");
    expect(second.status).toBe(200);
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(second.body.version).toBe(1);

    const write = await request(app).post("/api/tests").send({ title: "New test" });
    expect(write.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const third = await request(app).get("/api/tests");
    expect(third.status).toBe(200);
    expect(third.headers["x-cache"]).toBe("MISS");
    expect(third.body.version).toBe(2);
  });

  it("applies cache + invalidation for /api/writings", async () => {
    const { default: writingRoutes } = await import("../../routes/writing.route.js");
    const app = express();
    app.use(express.json());
    app.use("/api/writings", writingRoutes);

    const first = await request(app).get("/api/writings");
    expect(first.status).toBe(200);
    expect(first.headers["x-cache"]).toBe("MISS");
    expect(first.body.version).toBe(1);

    const second = await request(app).get("/api/writings");
    expect(second.status).toBe(200);
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(second.body.version).toBe(1);

    const write = await request(app).put("/api/writings/w1").send({ title: "Updated" });
    expect(write.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const third = await request(app).get("/api/writings");
    expect(third.status).toBe(200);
    expect(third.headers["x-cache"]).toBe("MISS");
    expect(third.body.version).toBe(2);
  });

  it("applies cache + invalidation for /api/skills/modules", async () => {
    const { default: skillRoutes } = await import("../../routes/skills.routes.js");
    const app = express();
    app.use(express.json());
    app.use("/api/skills", skillRoutes);

    const first = await request(app).get("/api/skills/modules");
    expect(first.status).toBe(200);
    expect(first.headers["x-cache"]).toBe("MISS");
    expect(first.body.version).toBe(1);

    const second = await request(app).get("/api/skills/modules");
    expect(second.status).toBe(200);
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(second.body.version).toBe(1);

    const write = await request(app).post("/api/skills/admin/modules").send({ title: "Module A" });
    expect(write.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const third = await request(app).get("/api/skills/modules");
    expect(third.status).toBe(200);
    expect(third.headers["x-cache"]).toBe("MISS");
    expect(third.body.version).toBe(2);
  });
});
