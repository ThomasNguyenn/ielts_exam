import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testAttemptFindMock = vi.fn();
const writingSubmissionFindMock = vi.fn();
const speakingSessionFindMock = vi.fn();
const speakingFindMock = vi.fn();

vi.mock("../../models/TestAttempt.model.js", () => ({
  default: {
    find: (...args) => testAttemptFindMock(...args),
  },
}));

vi.mock("../../models/WritingSubmission.model.js", () => ({
  default: {
    find: (...args) => writingSubmissionFindMock(...args),
  },
}));

vi.mock("../../models/SpeakingSession.js", () => ({
  default: {
    find: (...args) => speakingSessionFindMock(...args),
  },
}));

vi.mock("../../models/Speaking.model.js", () => ({
  default: {
    find: (...args) => speakingFindMock(...args),
  },
}));

const chainObjectiveAttempts = (rows = []) => ({
  sort: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  populate: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(rows),
});

const chainSimpleFind = (rows = []) => ({
  sort: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(rows),
});

const buildRes = () => {
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

let getUserAttempts;

beforeAll(async () => {
  const adminController = await import("../../controllers/admin.controller.js");
  getUserAttempts = adminController.getUserAttempts;
});

beforeEach(() => {
  vi.clearAllMocks();
  testAttemptFindMock.mockReturnValue(chainObjectiveAttempts([]));
  writingSubmissionFindMock.mockReturnValue(chainSimpleFind([]));
  speakingSessionFindMock.mockReturnValue(chainSimpleFind([]));
  speakingFindMock.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  });
});

describe("admin.controller getUserAttempts speaking mapping", () => {
  it("returns speaking attempts with source/session metadata for speaking filter", async () => {
    const userId = "507f191e810c19729de860ea";
    const topicId = "507f1f77bcf86cd799439011";
    const sessionId = "507f1f77bcf86cd799439012";

    speakingSessionFindMock.mockReturnValue(chainSimpleFind([
      {
        _id: sessionId,
        questionId: topicId,
        analysis: { band_score: 6.5 },
        status: "completed",
        scoring_state: "completed",
        timestamp: new Date("2026-03-03T03:00:00.000Z"),
        error_logs_state: "failed",
        error_logs_error: "supplement timeout",
      },
    ]));
    speakingFindMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { _id: topicId, title: "Travel & Holidays" },
      ]),
    });

    const req = {
      params: { userId },
      query: { type: "speaking", page: "1", limit: "20" },
    };
    const res = buildRes();

    await getUserAttempts(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({
      source_id: sessionId,
      source_type: "speaking_session",
      type: "speaking",
      status: "completed",
      scoring_state: "completed",
      error_logs_state: "failed",
      error_logs_error: "supplement timeout",
    });
    expect(payload.data[0]?.test_id?.title).toBe("Travel & Holidays");
  });

  it("returns 400 when user id is invalid", async () => {
    const req = {
      params: { userId: "invalid-user-id" },
      query: { type: "speaking" },
    };
    const res = buildRes();

    await getUserAttempts(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0] || {};
    const errorMessage = payload?.error?.message || payload?.message || null;
    expect(errorMessage).toBe("Invalid user id");
  });
});
