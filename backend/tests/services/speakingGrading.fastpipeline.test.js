import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  speakingFindById: vi.fn(),
  sessionFindById: vi.fn(),
  cloudinaryDestroy: vi.fn(),
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
  },
}));

vi.mock("../../utils/cloudinary.js", () => ({
  default: {
    uploader: {
      destroy: (...args) => mocks.cloudinaryDestroy(...args),
    },
  },
}));

vi.mock("../../utils/aiClient.js", () => ({
  requestGeminiJsonWithFallback: (...args) => mocks.requestGeminiJsonWithFallback(...args),
}));

describe("speaking grading fast-pipeline compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    process.env.GEMINI_API_KEY = "";

    mocks.speakingFindById.mockResolvedValue({
      _id: "topic-1",
      prompt: "Describe your hometown.",
    });
    mocks.cloudinaryDestroy.mockResolvedValue({ result: "ok" });
  });

  it.each([
    { startStatus: "processing", startScoringState: "processing" },
    { startStatus: "processing", startScoringState: "provisional_ready" },
  ])(
    "moves session from $startScoringState to completed after worker scoring",
    async ({ startStatus, startScoringState }) => {
      const session = {
        _id: "session-1",
        questionId: "topic-1",
        status: startStatus,
        scoring_state: startScoringState,
        audioUrl: "C:\\temp\\missing-speaking-audio.webm",
        audioMimeType: "audio/webm",
        transcript: "I am from a small coastal city.",
        metrics: {
          wpm: 120,
          pauses: {
            pauseCount: 4,
            totalPauseDuration: 1800,
          },
        },
        analysis: null,
        ai_source: null,
        provisional_analysis: { band_score: 6.5 },
        audioPublicId: null,
        timestamp: new Date(),
        createdAt: new Date(),
        save: vi.fn(async function saveSelf() {
          return this;
        }),
      };

      mocks.sessionFindById.mockResolvedValue(session);

      const { scoreSpeakingSessionById } = await import("../../services/speakingGrading.service.js");
      const result = await scoreSpeakingSessionById({ sessionId: "session-1" });

      expect(result.skipped).toBe(false);
      expect(result.session.status).toBe("completed");
      expect(result.session.scoring_state).toBe("completed");
      expect(result.session.analysis).toBeTruthy();
      expect(result.session.save).toHaveBeenCalledTimes(1);
    },
  );
});
