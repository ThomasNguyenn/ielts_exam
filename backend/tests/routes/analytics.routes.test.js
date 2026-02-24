import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedControllers = vi.hoisted(() => ({
  getSkillsBreakdown: vi.fn((req, res) => res.status(200).json({ ok: true })),
  getWeaknessAnalysis: vi.fn((req, res) => res.status(200).json({ ok: true })),
  getProgressHistory: vi.fn((req, res) => res.status(200).json({ ok: true })),
  getStudentAnalytics: vi.fn((req, res) => res.status(200).json({ ok: true })),
  getAnalyticsDashboard: vi.fn((req, res) => res.status(200).json({ ok: true })),
  getAdminStudentAnalyticsDashboard: vi.fn((req, res) => res.status(200).json({ ok: true })),
  getErrorAnalytics: vi.fn((req, res) => res.status(200).json({ ok: true })),
  getErrorAnalyticsDetails: vi.fn((req, res) => res.status(200).json({ route: "self-errors-details" })),
  getAIInsights: vi.fn((req, res) => res.status(200).json({ ok: true })),
  getAdminStudentErrorAnalytics: vi.fn((req, res) =>
    res.status(200).json({ route: "admin-errors", studentId: req.params.studentId })),
  getAdminStudentErrorAnalyticsDetails: vi.fn((req, res) =>
    res.status(200).json({ route: "admin-errors-details", studentId: req.params.studentId })),
  getAdminStudentAIInsights: vi.fn((req, res) =>
    res.status(200).json({ route: "admin-ai-insights", studentId: req.params.studentId })),
}));

vi.mock("../../controllers/analytics.controller.js", () => mockedControllers);
vi.mock("../../middleware/auth.middleware.js", () => ({
  verifyToken: (req, _res, next) => {
    req.user = { userId: "507f1f77bcf86cd799439011", role: "teacher" };
    next();
  },
  isTeacherOrAdmin: (_req, _res, next) => next(),
}));

describe("analytics admin routes", () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: analyticsRoutes } = await import("../../routes/analytics.routes.js");
    app = express();
    app.use("/api/analytics", analyticsRoutes);
  });

  it("routes /admin/:studentId/errors to getAdminStudentErrorAnalytics", async () => {
    const res = await request(app).get("/api/analytics/admin/student-123/errors");

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("admin-errors");
    expect(res.body.studentId).toBe("student-123");
    expect(mockedControllers.getAdminStudentErrorAnalytics).toHaveBeenCalledTimes(1);
  });

  it("routes /errors/details to getErrorAnalyticsDetails", async () => {
    const res = await request(app).get("/api/analytics/errors/details");

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("self-errors-details");
    expect(mockedControllers.getErrorAnalyticsDetails).toHaveBeenCalledTimes(1);
  });

  it("routes /admin/:studentId/errors/details to getAdminStudentErrorAnalyticsDetails", async () => {
    const res = await request(app).get("/api/analytics/admin/student-789/errors/details");

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("admin-errors-details");
    expect(res.body.studentId).toBe("student-789");
    expect(mockedControllers.getAdminStudentErrorAnalyticsDetails).toHaveBeenCalledTimes(1);
  });

  it("routes /admin/:studentId/ai-insights to getAdminStudentAIInsights", async () => {
    const res = await request(app).get("/api/analytics/admin/student-456/ai-insights");

    expect(res.status).toBe(200);
    expect(res.body.route).toBe("admin-ai-insights");
    expect(res.body.studentId).toBe("student-456");
    expect(mockedControllers.getAdminStudentAIInsights).toHaveBeenCalledTimes(1);
  });
});
