import { beforeAll, describe, expect, it, vi } from "vitest";

let getAdminStudentErrorAnalytics;
let getAdminStudentErrorAnalyticsDetails;
let getAdminStudentAIInsights;

const createMockRes = () => {
  const res = {
    set: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  res.set.mockReturnValue(res);
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const createGetterOnlyQueryReq = (requestId) => {
  const req = {
    requestId,
    method: "GET",
    originalUrl: "/api/analytics/admin/not-an-object-id/errors",
    params: { studentId: "not-an-object-id" },
    user: { userId: "teacher-1", role: "teacher" },
  };

  Object.defineProperty(req, "query", {
    configurable: true,
    enumerable: true,
    get() {
      return { range: "30d", page: "1", limit: "8", _t: "1772202430482" };
    },
  });

  return req;
};

beforeAll(async () => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";
  const analyticsController = await import("../../controllers/analytics.controller.js");
  getAdminStudentErrorAnalytics = analyticsController.getAdminStudentErrorAnalytics;
  getAdminStudentErrorAnalyticsDetails = analyticsController.getAdminStudentErrorAnalyticsDetails;
  getAdminStudentAIInsights = analyticsController.getAdminStudentAIInsights;
});

describe("analytics admin scoped wrappers", () => {
  it.each([
    ["getAdminStudentErrorAnalytics", () => getAdminStudentErrorAnalytics],
    ["getAdminStudentErrorAnalyticsDetails", () => getAdminStudentErrorAnalyticsDetails],
    ["getAdminStudentAIInsights", () => getAdminStudentAIInsights],
  ])("%s handles getter-only req.query without TypeError", async (_label, getHandler) => {
    const req = createGetterOnlyQueryReq("req-admin-scope");
    const res = createMockRes();
    const handler = getHandler();

    await expect(handler(req, res)).resolves.not.toThrow();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      requestId: "req-admin-scope",
      error: {
        code: "BAD_REQUEST",
        message: "Invalid user id",
      },
    });
  });
});
