import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  speakingFindById: vi.fn(),
  sessionFindById: vi.fn(),
  sessionFindOneAndUpdate: vi.fn(),
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
    findOneAndUpdate: (...args) => mocks.sessionFindOneAndUpdate(...args),
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
      part: 2,
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
        audio_upload_state: "ready",
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

      mocks.sessionFindById.mockImplementation(async () => session);
      mocks.sessionFindOneAndUpdate.mockImplementation(async (_filter, update) => {
        Object.assign(session, update?.$set || {});
        return session;
      });

      const { scoreSpeakingSessionById } = await import("../../services/speakingGrading.service.js");
      const result = await scoreSpeakingSessionById({ sessionId: "session-1" });

      expect(result.skipped).toBe(false);
      expect(result.session.status).toBe("completed");
      expect(result.session.scoring_state).toBe("completed");
      expect(result.session.analysis).toBeTruthy();
      expect(mocks.sessionFindOneAndUpdate).toHaveBeenCalled();
    },
  );

  it("throws retriable error when phase2 starts before audio upload is ready", async () => {
    const session = {
      _id: "session-2",
      questionId: "topic-1",
      status: "processing",
      scoring_state: "phase1_ready",
      audio_upload_state: "uploading",
      audioUrl: null,
      audioMimeType: "audio/webm",
      transcript: "Sample transcript",
      metrics: { wpm: 110, pauses: { pauseCount: 5 } },
      phase1_analysis: {
        lexical_resource: { score: 6, feedback: "ok" },
        grammatical_range: { score: 6, feedback: "ok" },
      },
      save: vi.fn(async function saveSelf() {
        return this;
      }),
    };

    mocks.sessionFindById.mockResolvedValue(session);
    const { scoreSpeakingPhase2ById } = await import("../../services/speakingGrading.service.js");
    await expect(scoreSpeakingPhase2ById({ sessionId: "session-2" }))
      .rejects.toMatchObject({ code: "PHASE2_AUDIO_NOT_READY" });
  });

  it("runs phase2 text fallback from transcript when cloud upload failed", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const session = {
      _id: "session-3",
      questionId: "topic-1",
      status: "processing",
      scoring_state: "phase1_ready",
      audio_upload_state: "failed",
      audio_upload_error: "cloudinary timeout",
      audioUrl: null,
      audioMimeType: "audio/webm",
      transcript: "I usually speak about my hometown in detail.",
      metrics: { wpm: 118, pauses: { pauseCount: 4 } },
      phase1_analysis: {
        lexical_resource: { score: 6.0, feedback: "lex" },
        grammatical_range: { score: 6.0, feedback: "gram" },
      },
      provisional_analysis: {
        band_score: 6.0,
      },
      timestamp: new Date(),
      createdAt: new Date(),
      save: vi.fn(async function saveSelf() {
        return this;
      }),
    };

    mocks.sessionFindById.mockImplementation(async () => session);
    mocks.sessionFindOneAndUpdate.mockImplementation(async (_filter, update) => {
      Object.assign(session, update?.$set || {});
      return session;
    });
    mocks.requestGeminiJsonWithFallback.mockResolvedValue({
      model: "gemini-2.5-flash",
      data: {
        fluency_coherence: { score: 6.0, feedback: "fluency" },
        pronunciation: { score: 6.0, feedback: "pron" },
        pronunciation_heatmap: [],
        focus_areas: [],
        intonation_pacing: { pace_wpm: 118, pitch_variation: "Acceptable", feedback: "ok" },
        next_step: "practice",
        general_feedback: "ok",
        error_logs: [],
      },
    });

    const { scoreSpeakingPhase2ById } = await import("../../services/speakingGrading.service.js");
    const result = await scoreSpeakingPhase2ById({ sessionId: "session-3" });

    expect(result.session.status).toBe("completed");
    expect(String(result.session.phase2_source || "")).toContain("text_fallback");
    expect(result.analysis).toBeTruthy();
    expect(mocks.requestGeminiJsonWithFallback).toHaveBeenCalled();
    const fallbackCall = mocks.requestGeminiJsonWithFallback.mock.calls[0][0];
    expect(Array.isArray(fallbackCall?.contents)).toBe(true);
    expect(fallbackCall.contents).toHaveLength(1);
  });
});
