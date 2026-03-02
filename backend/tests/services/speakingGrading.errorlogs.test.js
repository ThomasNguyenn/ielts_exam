import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  speakingFindById: vi.fn(),
  sessionFindById: vi.fn(),
  sessionFindByIdAndUpdate: vi.fn(),
  requestGeminiJsonWithFallback: vi.fn(),
}));

vi.mock("../../models/Speaking.model.js", () => ({
  default: {
    findById: (...args) => mocks.speakingFindById(...args),
  },
}));

vi.mock("../../models/SpeakingSession.js", () => ({
  default: {
    findById: (...args) => mocks.sessionFindById(...args),
    findByIdAndUpdate: (...args) => mocks.sessionFindByIdAndUpdate(...args),
  },
}));

vi.mock("../../utils/cloudinary.js", () => ({
  default: {
    uploader: {
      destroy: vi.fn(),
    },
  },
}));

vi.mock("../../utils/aiClient.js", () => ({
  requestGeminiJsonWithFallback: (...args) => mocks.requestGeminiJsonWithFallback(...args),
}));

describe("speaking error logs background scoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.GEMINI_API_KEY = "";
  });

  it("writes ready error logs directly from phase payload when base logs are enough", async () => {
    const session = {
      _id: "session-logs-1",
      questionId: "topic-1",
      status: "completed",
      scoring_state: "completed",
      transcript: "I is and he are and I speak too fast.",
      error_logs_state: "pending",
      analysis: {
        band_score: 6,
      },
      phase1_analysis: {
        error_logs: [
          { code: "S-G1", snippet: "I is", explanation: "grammar" },
          { code: "S-L1", snippet: "very very", explanation: "lexical repetition" },
        ],
      },
      phase2_analysis: {
        error_logs: [
          { code: "S-F1", snippet: "too fast", explanation: "fluency pacing" },
          { code: "S-P1", snippet: "world", explanation: "pronunciation stress" },
        ],
      },
      save: vi.fn(async function saveSelf() {
        return this;
      }),
    };

    mocks.speakingFindById.mockResolvedValue({
      _id: "topic-1",
      part: 2,
      prompt: "Describe your hometown",
    });
    mocks.sessionFindById.mockImplementation(async () => session);
    mocks.sessionFindByIdAndUpdate.mockImplementation(async (_id, update) => {
      Object.assign(session, update?.$set || {});
      return session;
    });

    const { scoreSpeakingErrorLogsById } = await import("../../services/speakingGrading.service.js");
    const result = await scoreSpeakingErrorLogsById({ sessionId: "session-logs-1" });

    expect(result.skipped).toBe(false);
    expect(result.reason).toBe("ready");
    expect(result.session.error_logs_state).toBe("ready");
    expect(Array.isArray(result.session.analysis?.error_logs)).toBe(true);
    expect(result.session.analysis.error_logs.length).toBeGreaterThanOrEqual(4);
    expect(mocks.requestGeminiJsonWithFallback).not.toHaveBeenCalled();
  });

  it("marks state failed and throws when AI supplement fails", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.SPEAKING_ERROR_LOGS_MIN_COUNT = "4";

    const session = {
      _id: "session-logs-2",
      questionId: "topic-1",
      status: "completed",
      scoring_state: "completed",
      transcript: "Short transcript",
      error_logs_state: "pending",
      analysis: {
        band_score: 5.5,
      },
      phase1_analysis: { error_logs: [] },
      phase2_analysis: { error_logs: [] },
      save: vi.fn(async function saveSelf() {
        return this;
      }),
    };

    mocks.speakingFindById.mockResolvedValue({
      _id: "topic-1",
      part: 1,
      prompt: "Topic",
    });
    mocks.sessionFindById.mockImplementation(async () => session);
    mocks.sessionFindByIdAndUpdate.mockImplementation(async (_id, update) => {
      Object.assign(session, update?.$set || {});
      return session;
    });
    mocks.requestGeminiJsonWithFallback.mockRejectedValue(new Error("supplement timeout"));

    const { scoreSpeakingErrorLogsById } = await import("../../services/speakingGrading.service.js");
    await expect(scoreSpeakingErrorLogsById({ sessionId: "session-logs-2", force: true }))
      .rejects
      .toMatchObject({ code: "SPEAKING_ERROR_LOGS_FAILED" });

    expect(session.error_logs_state).toBe("failed");
    expect(String(session.error_logs_error || "").length).toBeGreaterThan(0);
  });
});

