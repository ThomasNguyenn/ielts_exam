import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const speakingSessionFindMock = vi.fn();
const speakingSessionFindOneAndUpdateMock = vi.fn();
const finalizeSpeakingSessionByIdMock = vi.fn();
const enqueueSpeakingAiPhase1JobMock = vi.fn();
const enqueueSpeakingAiPhase2JobMock = vi.fn();

vi.mock("../../models/SpeakingSession.js", () => ({
  default: {
    find: (...args) => speakingSessionFindMock(...args),
    findOneAndUpdate: (...args) => speakingSessionFindOneAndUpdateMock(...args),
  },
}));

vi.mock("../../services/speakingGrading.service.js", () => ({
  isUsableSpeakingAnalysis: (analysis) =>
    Boolean(analysis) && typeof analysis === "object" && Object.keys(analysis).length > 0,
  finalizeSpeakingSessionById: (...args) => finalizeSpeakingSessionByIdMock(...args),
}));

vi.mock("../../queues/ai.queue.js", () => ({
  enqueueSpeakingAiPhase1Job: (...args) => enqueueSpeakingAiPhase1JobMock(...args),
  enqueueSpeakingAiPhase2Job: (...args) => enqueueSpeakingAiPhase2JobMock(...args),
}));

const buildFindChain = (rows) => ({
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
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

let repairStuckSpeakingSessions;

beforeAll(async () => {
  const adminController = await import("../../controllers/admin.controller.js");
  repairStuckSpeakingSessions = adminController.repairStuckSpeakingSessions;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin.controller repairStuckSpeakingSessions", () => {
  it("returns dry-run summary without mutating DB or queue", async () => {
    const oldTimestamp = new Date(Date.now() - 2 * 60 * 1000);
    speakingSessionFindMock.mockReturnValue(buildFindChain([
      {
        _id: "s-finalize",
        timestamp: oldTimestamp,
        analysis: {},
        phase1_analysis: { lexical_resource: { score: 5 } },
        phase2_analysis: { fluency_coherence: { score: 6 } },
      },
      {
        _id: "s-p1",
        timestamp: oldTimestamp,
        analysis: null,
        phase1_analysis: null,
        phase2_analysis: { pronunciation: { score: 6 } },
        phase1_auto_requeue_count: 0,
      },
      {
        _id: "s-p2",
        timestamp: oldTimestamp,
        analysis: null,
        phase1_analysis: { grammatical_range: { score: 6 } },
        phase2_analysis: null,
        audio_upload_state: "ready",
        phase2_auto_requeue_count: 0,
      },
      {
        _id: "s-fresh",
        timestamp: new Date(),
        analysis: null,
        phase1_analysis: { lexical_resource: { score: 5 } },
        phase2_analysis: null,
        audio_upload_state: "ready",
      },
    ]));

    const req = {
      body: { dry_run: true, limit: 50, window_hours: 24 },
      user: { userId: "admin-1", role: "admin" },
    };
    const res = buildRes();

    await repairStuckSpeakingSessions(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0]?.data || {};
    expect(payload.scanned).toBe(4);
    expect(payload.finalized).toBe(1);
    expect(payload.requeued_phase1).toBe(1);
    expect(payload.requeued_phase2).toBe(1);
    expect(payload.skipped_not_stuck).toBe(1);
    expect(payload.dry_run).toBe(true);
    expect(payload.window_hours).toBe(24);
    expect(speakingSessionFindOneAndUpdateMock).not.toHaveBeenCalled();
    expect(finalizeSpeakingSessionByIdMock).not.toHaveBeenCalled();
    expect(enqueueSpeakingAiPhase1JobMock).not.toHaveBeenCalled();
    expect(enqueueSpeakingAiPhase2JobMock).not.toHaveBeenCalled();
  });

  it("finalizes and requeues missing phases in execution mode with guardrail", async () => {
    const oldTimestamp = new Date(Date.now() - 2 * 60 * 1000);
    speakingSessionFindMock.mockReturnValue(buildFindChain([
      {
        _id: "s-finalize",
        timestamp: oldTimestamp,
        analysis: {},
        phase1_analysis: { lexical_resource: { score: 6 } },
        phase2_analysis: { fluency_coherence: { score: 6 } },
      },
      {
        _id: "s-requeue-p1",
        timestamp: oldTimestamp,
        analysis: null,
        phase1_analysis: null,
        phase2_analysis: { pronunciation: { score: 6 } },
        phase1_auto_requeue_count: 0,
      },
      {
        _id: "s-guardrail",
        timestamp: oldTimestamp,
        analysis: null,
        phase1_analysis: { grammatical_range: { score: 5.5 } },
        phase2_analysis: null,
        audio_upload_state: "failed",
        phase2_auto_requeue_count: 0,
      },
    ]));

    finalizeSpeakingSessionByIdMock.mockResolvedValue({
      finalized: true,
      session: { analysis: { band_score: 6 } },
    });
    speakingSessionFindOneAndUpdateMock
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({ _id: "s-requeue-p1" }),
      })
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null),
      });
    enqueueSpeakingAiPhase1JobMock.mockResolvedValue({ queued: true, jobId: "job-p1" });

    const req = {
      body: { dry_run: false, limit: 50, window_hours: 24 },
      user: { userId: "admin-1", role: "admin" },
    };
    const res = buildRes();

    await repairStuckSpeakingSessions(req, res);

    expect(finalizeSpeakingSessionByIdMock).toHaveBeenCalledWith({ sessionId: "s-finalize" });
    expect(enqueueSpeakingAiPhase1JobMock).toHaveBeenCalledTimes(1);
    expect(enqueueSpeakingAiPhase1JobMock).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "s-requeue-p1",
      force: true,
      repairTag: expect.stringContaining("backfill-"),
    }));
    expect(enqueueSpeakingAiPhase2JobMock).not.toHaveBeenCalled();

    const payload = res.json.mock.calls[0][0]?.data || {};
    expect(payload.scanned).toBe(3);
    expect(payload.finalized).toBe(1);
    expect(payload.requeued_phase1).toBe(1);
    expect(payload.requeued_phase2).toBe(0);
    expect(payload.skipped_guardrail).toBe(1);
    expect(Array.isArray(payload.errors)).toBe(true);
    expect(payload.errors).toHaveLength(0);
  });
});
