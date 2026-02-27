import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const jwtVerifyMock = vi.fn();
const writingSubmissionFindByIdMock = vi.fn();
const writingFindByIdMock = vi.fn();
const createWritingLiveRoomMock = vi.fn();
const resolveWritingLiveRoomMock = vi.fn();
const getWritingLiveRoomContextMock = vi.fn();
const getWritingLiveRoomStateMock = vi.fn();
const scoreWritingSubmissionFastByIdMock = vi.fn();

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: jwtVerifyMock,
    sign: vi.fn(),
    decode: vi.fn(),
  },
}));

vi.mock("../../models/WritingSubmission.model.js", () => ({
  default: {
    findById: writingSubmissionFindByIdMock,
  },
}));

vi.mock("../../models/Writing.model.js", () => ({
  default: {
    findById: writingFindByIdMock,
  },
}));

vi.mock("../../services/writingLiveRoom.service.js", () => ({
  createWritingLiveRoom: createWritingLiveRoomMock,
  resolveWritingLiveRoom: resolveWritingLiveRoomMock,
  getWritingLiveRoomContext: getWritingLiveRoomContextMock,
  getWritingLiveRoomState: getWritingLiveRoomStateMock,
}));

vi.mock("../../services/writingFastScoring.service.js", () => ({
  scoreWritingSubmissionFastById: scoreWritingSubmissionFastByIdMock,
}));

let app;

const VALID_SUBMISSION_ID = "507f191e810c19729de860ea";

const buildSubmissionDoc = (overrides = {}) => {
  const base = {
    _id: VALID_SUBMISSION_ID,
    writing_answers: [
      {
        task_id: "task-1",
        task_title: "Task 1",
        answer_text: "Sample answer.",
      },
    ],
    is_ai_fast_graded: true,
    ai_fast_result: {
      band_score: 6.5,
      criteria_scores: {
        task_response: 6.5,
        coherence_cohesion: 6.0,
        lexical_resource: 6.0,
        grammatical_range_accuracy: 6.5,
      },
      top_issues: {
        grammatical_range_accuracy: [],
        lexical_resource: [],
      },
    },
  };
  const merged = {
    ...base,
    ...overrides,
  };

  return {
    ...merged,
    lean: vi.fn().mockResolvedValue({ ...merged }),
  };
};

const buildWritingFindChain = (task = {}) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue({
      title: task.title || "Task 1",
      prompt: task.prompt || "Prompt",
      image_url: task.image_url || null,
      task_type: task.task_type || "task2",
    }),
  }),
});

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
  process.env.FRONTEND_ORIGINS = process.env.FRONTEND_ORIGINS || "http://localhost:5173";
  const { createApp } = await import("../../app.js");
  app = createApp({ startBackgroundJobs: false });
});

beforeEach(() => {
  vi.clearAllMocks();

  jwtVerifyMock.mockReturnValue({
    userId: "teacher-1",
    role: "teacher",
    tokenType: "access",
  });

  writingSubmissionFindByIdMock.mockImplementation(() => buildSubmissionDoc());
  writingFindByIdMock.mockImplementation(() => buildWritingFindChain());
  createWritingLiveRoomMock.mockResolvedValue({
    roomCode: "AB12CD",
    expiresAt: "2030-01-01T00:00:00.000Z",
    ttlSec: 900,
  });
  resolveWritingLiveRoomMock.mockResolvedValue({
    roomCode: "AB12CD",
    expiresAt: "2030-01-01T00:00:00.000Z",
  });
  getWritingLiveRoomContextMock.mockResolvedValue({
    roomCode: "AB12CD",
    expiresAt: "2030-01-01T00:00:00.000Z",
    ttlMs: 120000,
    submission: {
      _id: VALID_SUBMISSION_ID,
      writing_answers: [{ task_id: "task-1", task_title: "Task 1", answer_text: "Sample answer." }],
      ai_fast_result: {
        band_score: 6.5,
        criteria_scores: {
          task_response: 6.5,
          coherence_cohesion: 6.0,
          lexical_resource: 6.0,
          grammatical_range_accuracy: 6.5,
        },
      },
    },
    room: {
      teacher_online: true,
      teacher_count: 1,
      active_task_id: "task-1",
      highlights: [],
      teacher_disconnect_grace_ms: 60000,
    },
  });
  getWritingLiveRoomStateMock.mockReturnValue(null);
});

describe("writing live-room controller routes", () => {
  it("returns 401 when creating live room without auth token", async () => {
    const response = await request(app).post(`/api/writings/submissions/${VALID_SUBMISSION_ID}/live-room`);
    expect(response.status).toBe(401);
    expect(createWritingLiveRoomMock).not.toHaveBeenCalled();
  });

  it("creates live room for teacher", async () => {
    const response = await request(app)
      .post(`/api/writings/submissions/${VALID_SUBMISSION_ID}/live-room`)
      .set("Authorization", "Bearer access-token")
      .send({});

    expect(response.status).toBe(201);
    expect(response.body?.success).toBe(true);
    expect(response.body?.data?.roomCode).toBe("AB12CD");
    expect(response.body?.data?.sharedRoute).toBe("/writing-live/AB12CD");
    expect(createWritingLiveRoomMock).toHaveBeenCalledWith({
      submissionId: VALID_SUBMISSION_ID,
      createdBy: "teacher-1",
    });
  });

  it("resolves room code for authenticated users", async () => {
    const response = await request(app)
      .post("/api/writings/live-room/resolve")
      .set("Authorization", "Bearer access-token")
      .send({ code: "ab12cd" });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(response.body?.data?.roomCode).toBe("AB12CD");
    expect(response.body?.data?.route).toBe("/writing-live/AB12CD");
    expect(resolveWritingLiveRoomMock).toHaveBeenCalledWith("ab12cd");
  });

  it("returns live room context payload", async () => {
    const response = await request(app)
      .get("/api/writings/live-room/AB12CD/context")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(response.body?.data?.roomCode).toBe("AB12CD");
    expect(response.body?.data?.room?.teacher_online).toBe(true);
    expect(Array.isArray(response.body?.data?.submission?.writing_answers)).toBe(true);
    expect(getWritingLiveRoomContextMock).toHaveBeenCalledWith("AB12CD");
  });
});

