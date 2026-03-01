import { beforeEach, describe, expect, it, vi } from "vitest";

const testAttemptFindMock = vi.hoisted(() => vi.fn());
const writingSubmissionFindMock = vi.hoisted(() => vi.fn());
const speakingSessionFindMock = vi.hoisted(() => vi.fn());
const cacheMocks = vi.hoisted(() => ({
  getJson: vi.fn(),
  setJson: vi.fn(async () => true),
}));

vi.mock("dotenv", () => ({
  default: {
    config: vi.fn(),
  },
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    constructor() {
      this.chat = {
        completions: {
          create: vi.fn(),
        },
      };
    }
  },
}));

vi.mock("mongoose", () => ({
  default: {
    Types: {
      ObjectId: {
        isValid: vi.fn(() => true),
      },
    },
  },
}));

vi.mock("../../models/TestAttempt.model.js", () => ({
  default: {
    find: testAttemptFindMock,
  },
}));

vi.mock("../../models/WritingSubmission.model.js", () => ({
  default: {
    find: writingSubmissionFindMock,
  },
}));

vi.mock("../../models/SpeakingSession.js", () => ({
  default: {
    find: speakingSessionFindMock,
  },
}));

vi.mock("../../models/Test.model.js", () => ({
  default: {},
}));

vi.mock("../../services/responseCache.redis.js", () => cacheMocks);

const createFindChain = (rows = []) => ({
  sort: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  lean: vi.fn(async () => rows),
});

const createRes = () => {
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

const baseReq = {
  requestId: "req-ai-insights",
  method: "GET",
  originalUrl: "/api/analytics/ai-insights",
  query: { range: "30d", skill: "all" },
  user: { userId: "507f1f77bcf86cd799439011", role: "student" },
};

describe("analytics.controller getAIInsights cache behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "";

    testAttemptFindMock.mockImplementation(() => createFindChain([
      {
        type: "reading",
        submitted_at: new Date("2026-02-01T00:00:00.000Z"),
        error_logs: [
          {
            task_type: "tfng",
            error_category: "FORM",
            error_code: "R-FORM-01",
          },
        ],
      },
    ]));
    writingSubmissionFindMock.mockImplementation(() => createFindChain([]));
    speakingSessionFindMock.mockImplementation(() => createFindChain([]));
    cacheMocks.getJson.mockResolvedValue(null);
    cacheMocks.setJson.mockResolvedValue(true);
  });

  it("returns cached insights when Redis has a hit", async () => {
    const cachedPayload = {
      no_data: false,
      overview: "cached overview",
      actionable_advice: ["cached tip"],
      recommended_practice: [],
      encouragement: "cached",
      filters: { range: "30d", skill: "all" },
    };
    cacheMocks.getJson.mockResolvedValueOnce(cachedPayload);

    const { getAIInsights } = await import("../../controllers/analytics.controller.js");
    const res = createRes();

    await getAIInsights(baseReq, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: cachedPayload,
    });
    expect(cacheMocks.setJson).not.toHaveBeenCalled();
  });

  it("computes heuristic insights and stores cache on miss", async () => {
    const { getAIInsights } = await import("../../controllers/analytics.controller.js");
    const res = createRes();

    await getAIInsights(baseReq, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0];
    expect(payload?.success).toBe(true);
    expect(payload?.data?.no_data).toBe(false);
    expect(Array.isArray(payload?.data?.actionable_advice)).toBe(true);
    expect(cacheMocks.setJson).toHaveBeenCalledTimes(1);
  });

  it("falls back gracefully when Redis read throws", async () => {
    cacheMocks.getJson.mockRejectedValueOnce(new Error("redis down"));
    const { getAIInsights } = await import("../../controllers/analytics.controller.js");
    const res = createRes();

    await getAIInsights(baseReq, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0];
    expect(payload?.success).toBe(true);
    expect(payload?.data?.no_data).toBe(false);
  });
});
