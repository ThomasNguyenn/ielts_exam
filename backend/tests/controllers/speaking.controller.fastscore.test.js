import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  speakingFindById: vi.fn(),
  enqueueSpeakingAiScoreJob: vi.fn(),
  isAiAsyncModeEnabled: vi.fn(),
  isAiQueueReady: vi.fn(),
  scoreSpeakingSessionById: vi.fn(),
  generateMockExaminerFollowUp: vi.fn(),
  ensurePart3ConversationScript: vi.fn(),
  evaluateSpeakingProvisionalScore: vi.fn(),
  addXP: vi.fn(),
  checkAchievements: vi.fn(),
  uploadStreamFactory: vi.fn(),
  sessionInstances: [],
  findByIdAndUpdate: vi.fn(),
}));

vi.mock("../../models/Speaking.model.js", () => ({
  default: {
    findById: mocks.speakingFindById,
  },
}));

vi.mock("../../models/SpeakingSession.js", () => {
  function MockSpeakingSession(data) {
    Object.assign(this, data);
    this._id = "session-1";
    this.save = vi.fn(async () => this);
    mocks.sessionInstances.push(this);
  }
  MockSpeakingSession.findByIdAndUpdate = mocks.findByIdAndUpdate;
  return { default: MockSpeakingSession };
});

vi.mock("../../utils/cloudinary.js", () => ({
  default: {
    uploader: {
      upload_stream: (...args) => mocks.uploadStreamFactory(...args),
    },
  },
}));

vi.mock("../../config/queue.config.js", () => ({
  isAiAsyncModeEnabled: (...args) => mocks.isAiAsyncModeEnabled(...args),
  isAiQueueReady: (...args) => mocks.isAiQueueReady(...args),
}));

vi.mock("../../queues/ai.queue.js", () => ({
  enqueueSpeakingAiScoreJob: (...args) => mocks.enqueueSpeakingAiScoreJob(...args),
  isAiQueueReady: (...args) => mocks.isAiQueueReady(...args),
}));

vi.mock("../../services/speakingGrading.service.js", () => ({
  scoreSpeakingSessionById: (...args) => mocks.scoreSpeakingSessionById(...args),
  generateMockExaminerFollowUp: (...args) => mocks.generateMockExaminerFollowUp(...args),
}));

vi.mock("../../services/speakingReadAloud.service.js", () => ({
  ensurePart3ConversationScript: (...args) => mocks.ensurePart3ConversationScript(...args),
}));

vi.mock("../../services/speakingFastScore.service.js", () => ({
  evaluateSpeakingProvisionalScore: (...args) => mocks.evaluateSpeakingProvisionalScore(...args),
}));

vi.mock("../../services/gamification.service.js", () => ({
  addXP: (...args) => mocks.addXP(...args),
  XP_SPEAKING_SESSION: 150,
}));

vi.mock("../../services/achievement.service.js", () => ({
  checkAchievements: (...args) => mocks.checkAchievements(...args),
}));

const buildRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe("submitSpeaking fast-score behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.sessionInstances.length = 0;

    mocks.uploadStreamFactory.mockImplementation((_options, callback) => ({
      on: vi.fn(),
      end: vi.fn(() => callback(null, { secure_url: "https://cdn.example/audio.webm", public_id: "audio-1" })),
    }));
    mocks.findByIdAndUpdate.mockResolvedValue(null);

    mocks.speakingFindById.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ _id: "topic-1" }),
    }));

    mocks.isAiAsyncModeEnabled.mockReturnValue(true);
    mocks.isAiQueueReady.mockReturnValue(true);
    mocks.enqueueSpeakingAiScoreJob.mockResolvedValue({ queued: true, jobId: "job-1" });
    mocks.scoreSpeakingSessionById.mockResolvedValue(null);
    mocks.addXP.mockResolvedValue({ xpGained: 150, currentXP: 150, currentLevel: 1, levelUp: false });
    mocks.checkAchievements.mockResolvedValue([]);
  });

  it("returns queued response with provisional analysis when fast-score succeeds", async () => {
    mocks.evaluateSpeakingProvisionalScore.mockResolvedValue({
      transcript: "Sample transcript",
      provisionalAnalysis: {
        band_score: 6.5,
        fluency_coherence: { score: 6.5, feedback: "Fast metric" },
        lexical_resource: { score: 6.0, feedback: "Fast metric" },
        grammatical_range: { score: 6.0, feedback: "Fast metric" },
        pronunciation: { score: 7.0, feedback: "Fast metric" },
        general_feedback: "Provisional",
        sample_answer: "Pending",
      },
      provisionalSource: "formula_v1",
      sttSource: "openai:whisper-1",
    });

    const { submitSpeaking } = await import("../../controllers/speaking.controller.js");

    const req = {
      body: {
        questionId: "topic-1",
        transcript: "",
        wpm: 120,
        metrics: JSON.stringify({ pauseCount: 5, totalPauseDuration: 2500 }),
      },
      file: {
        buffer: Buffer.from("audio-data"),
        mimetype: "audio/webm",
      },
      user: { userId: "user-1", role: "student" },
    };
    const res = buildRes();

    await submitSpeaking(req, res);

    expect(res.status).toHaveBeenCalledWith(202);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.session_id).toBe("session-1");
    expect(payload.scoring_state).toBe("provisional_ready");
    expect(payload.provisional_source).toBe("formula_v1");
    expect(payload.provisional_analysis?.band_score).toBe(6.5);
    expect(payload.queued).toBe(true);
  });

  it("keeps processing state when fast-score errors (timeout/failure)", async () => {
    mocks.evaluateSpeakingProvisionalScore.mockRejectedValue(new Error("Fast score timed out"));

    const { submitSpeaking } = await import("../../controllers/speaking.controller.js");

    const req = {
      body: {
        questionId: "topic-1",
        transcript: "",
        wpm: 105,
        metrics: JSON.stringify({ pauseCount: 7, totalPauseDuration: 3800 }),
      },
      file: {
        buffer: Buffer.from("audio-data"),
        mimetype: "audio/webm",
      },
      user: { userId: "user-1", role: "student" },
    };
    const res = buildRes();

    await submitSpeaking(req, res);

    expect(res.status).toHaveBeenCalledWith(202);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.scoring_state).toBe("processing");
    expect(payload.provisional_analysis).toBeNull();
    expect(payload.provisional_source).toBeNull();
  });
});
