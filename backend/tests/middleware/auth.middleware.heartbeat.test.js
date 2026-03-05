import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const jwtVerifyMock = vi.fn();
const userFindByIdMock = vi.fn();
const userUpdateOneMock = vi.fn();

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: jwtVerifyMock,
  },
}));

vi.mock("../../models/User.model.js", () => ({
  default: {
    findById: userFindByIdMock,
    updateOne: userUpdateOneMock,
  },
}));

const buildStudentFindChain = (sessionId = "session-1") => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue({
      role: "student",
      activeSessionId: sessionId,
    }),
  }),
});

const createMockRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

let verifyToken;
let resetPresenceState;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
  const authMiddleware = await import("../../middleware/auth.middleware.js");
  verifyToken = authMiddleware.verifyToken;
  resetPresenceState = authMiddleware.__resetPresenceTouchStateForTests;
});

beforeEach(() => {
  vi.clearAllMocks();
  resetPresenceState();
  userUpdateOneMock.mockResolvedValue({ modifiedCount: 1 });
});

describe("auth middleware student presence heartbeat", () => {
  it("updates student lastSeenAt after valid token verification", async () => {
    jwtVerifyMock.mockReturnValue({
      userId: "student-1",
      role: "student",
      sessionId: "session-1",
      tokenType: "access",
    });
    userFindByIdMock.mockReturnValue(buildStudentFindChain("session-1"));

    const req = { headers: { authorization: "Bearer test.token" } };
    const res = createMockRes();
    const next = vi.fn();

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(userUpdateOneMock).toHaveBeenCalledTimes(1);
    expect(userUpdateOneMock).toHaveBeenCalledWith(
      {
        _id: "student-1",
        role: { $in: ["student", "studentIELTS", "studentACA"] },
        activeSessionId: "session-1",
      },
      {
        $set: {
          lastSeenAt: expect.any(Date),
        },
      },
    );
  });

  it("throttles repeated heartbeat writes inside 60 seconds", async () => {
    jwtVerifyMock.mockReturnValue({
      userId: "student-1",
      role: "student",
      sessionId: "session-1",
      tokenType: "access",
    });
    userFindByIdMock.mockReturnValue(buildStudentFindChain("session-1"));

    const req = { headers: { authorization: "Bearer test.token" } };
    const res = createMockRes();
    const next = vi.fn();

    await verifyToken(req, res, next);
    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(userUpdateOneMock).toHaveBeenCalledTimes(1);
  });

  it("does not touch presence for non-student roles", async () => {
    jwtVerifyMock.mockReturnValue({
      userId: "teacher-1",
      role: "teacher",
      tokenType: "access",
    });

    const req = { headers: { authorization: "Bearer teacher.token" } };
    const res = createMockRes();
    const next = vi.fn();

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(userFindByIdMock).not.toHaveBeenCalled();
    expect(userUpdateOneMock).not.toHaveBeenCalled();
  });
});
