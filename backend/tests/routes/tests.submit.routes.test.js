import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const submitExamFlowMock = vi.fn();
const jwtVerifyMock = vi.fn();
const userFindByIdMock = vi.fn();

class MockSubmissionError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "SubmissionError";
    this.statusCode = statusCode;
  }
}

vi.mock("../../services/testSubmission.service.js", () => ({
  SubmissionError: MockSubmissionError,
  submitExamFlow: submitExamFlowMock,
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: jwtVerifyMock,
    sign: vi.fn(),
    decode: vi.fn(),
  },
}));

vi.mock("../../models/User.model.js", () => ({
  default: {
    findById: userFindByIdMock,
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
  process.env.FRONTEND_ORIGINS = process.env.FRONTEND_ORIGINS || "http://localhost:5173";
  const { createApp } = await import("../../app.js");
  app = createApp({ startBackgroundJobs: false });
});

beforeEach(() => {
  vi.clearAllMocks();
  jwtVerifyMock.mockReturnValue({
    userId: "user-1",
    role: "teacher",
    tokenType: "access",
    email: "teacher@example.com",
  });
  userFindByIdMock.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "user-1",
        role: "teacher",
      }),
    }),
  });
});

describe("test submission route integration", () => {
  it("returns 401 for anonymous submit requests", async () => {
    const res = await request(app)
      .post("/api/tests/test-1/submit")
      .send({ answers: ["A"] });

    expect(res.status).toBe(401);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error?.message).toBe("No token provided");
    expect(submitExamFlowMock).not.toHaveBeenCalled();
  });

  it("forwards logged-in request payload to submitExamFlow", async () => {
    submitExamFlowMock.mockResolvedValue({
      score: 2,
      total: 2,
      wrong: 0,
      achievements: [],
      xpResult: null,
    });

    const res = await request(app)
      .post("/api/tests/test-1/submit")
      .set("Authorization", "Bearer access-token")
      .send({
        answers: ["A", "B"],
        isPractice: true,
        timeTaken: 120000,
      });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.score).toBe(2);
    expect(submitExamFlowMock).toHaveBeenCalledWith({
      testId: "test-1",
      userId: "user-1",
      body: expect.objectContaining({
        answers: ["A", "B"],
        isPractice: true,
        timeTaken: 120000,
      }),
    });
  });

  it("maps SubmissionError from service to client error response", async () => {
    submitExamFlowMock.mockRejectedValue(new MockSubmissionError(400, "answers must be an array"));

    const res = await request(app)
      .post("/api/tests/test-1/submit")
      .set("Authorization", "Bearer access-token")
      .send({
        answers: "A",
      });

    expect(res.status).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error?.message).toBe("answers must be an array");
  });

  it("supports writing submission payloads for logged-in requests", async () => {
    submitExamFlowMock.mockResolvedValue({
      score: 0,
      total: 0,
      wrong: 0,
      writingSubmissionId: "writing-sub-77",
      achievements: [{ key: "first-writing" }],
      xpResult: { added: 15 },
    });

    const res = await request(app)
      .post("/api/tests/writing-test-1/submit")
      .set("Authorization", "Bearer access-token")
      .send({
        answers: [],
        writing: ["My task response"],
        isPractice: false,
      });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.writingSubmissionId).toBe("writing-sub-77");
    expect(res.body?.data?.xpResult).toEqual({ added: 15 });
    expect(res.body?.data?.achievements).toEqual([{ key: "first-writing" }]);
  });
});
