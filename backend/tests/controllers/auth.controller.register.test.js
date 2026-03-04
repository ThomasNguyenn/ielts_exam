import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const userFindOneMock = vi.fn();
const userDeleteOneMock = vi.fn();
const invitationFindOneMock = vi.fn();
const invitationUpdateOneMock = vi.fn();
const sendVerificationEmailMock = vi.fn();
const sendPasswordResetEmailMock = vi.fn();
const getInvitationTokenRecordMock = vi.fn();
const cacheInvitationTokenMock = vi.fn();
const deleteInvitationTokenMock = vi.fn();
const bcryptGenSaltMock = vi.fn();
const bcryptHashMock = vi.fn();
const jwtSignMock = vi.fn();
const jwtDecodeMock = vi.fn();
const createdUsers = [];

const UserMock = vi.fn(function MockUser(payload) {
  Object.assign(this, payload);
  this._id = this._id || "user-123";
  this.save = vi.fn().mockResolvedValue(this);
  createdUsers.push(this);
});
UserMock.findOne = userFindOneMock;
UserMock.deleteOne = userDeleteOneMock;

vi.mock("../../models/User.model.js", () => ({
  default: UserMock,
}));

vi.mock("../../models/Invitation.model.js", () => ({
  default: {
    findOne: invitationFindOneMock,
    updateOne: invitationUpdateOneMock,
  },
}));

vi.mock("../../services/email.service.js", () => ({
  sendVerificationEmail: sendVerificationEmailMock,
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}));

vi.mock("../../services/invitationToken.redis.js", () => ({
  getInvitationTokenRecord: getInvitationTokenRecordMock,
  cacheInvitationToken: cacheInvitationTokenMock,
  deleteInvitationToken: deleteInvitationTokenMock,
}));

vi.mock("bcryptjs", () => ({
  default: {
    genSalt: bcryptGenSaltMock,
    hash: bcryptHashMock,
    compare: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: jwtSignMock,
    decode: jwtDecodeMock,
    verify: vi.fn(),
  },
}));

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    cookies: [],
  };
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  res.cookie = (...args) => {
    res.cookies.push(args);
    return res;
  };
  res.clearCookie = () => res;
  return res;
};

let register;

beforeAll(async () => {
  const module = await import("../../controllers/auth.controller.js");
  register = module.register;
});

beforeEach(() => {
  vi.clearAllMocks();
  createdUsers.length = 0;

  userFindOneMock.mockResolvedValue(null);
  userDeleteOneMock.mockResolvedValue({ deletedCount: 1 });
  invitationFindOneMock.mockResolvedValue(null);
  invitationUpdateOneMock.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
  sendVerificationEmailMock.mockResolvedValue(undefined);
  sendPasswordResetEmailMock.mockResolvedValue(undefined);
  getInvitationTokenRecordMock.mockResolvedValue(null);
  cacheInvitationTokenMock.mockResolvedValue(true);
  deleteInvitationTokenMock.mockResolvedValue(true);
  bcryptGenSaltMock.mockResolvedValue("salt");
  bcryptHashMock.mockResolvedValue("hashed-password");
  jwtSignMock.mockReturnValue("signed.jwt.token");
  jwtDecodeMock.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
});

describe("register", () => {
  it("creates user and sets refresh cookie when verification email succeeds", async () => {
    const req = {
      body: {
        email: "student@example.com",
        password: "Password1",
        name: "Student",
      },
    };
    const res = createMockResponse();

    await register(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(res.cookies).toHaveLength(1);
    expect(userDeleteOneMock).not.toHaveBeenCalled();
    expect(createdUsers[0]?.refreshTokenHash).toBeTruthy();
    expect(createdUsers[0]?.lastSeenAt).toBeInstanceOf(Date);
  });

  it("rolls back created user when verification email delivery fails", async () => {
    sendVerificationEmailMock.mockRejectedValueOnce(new Error("SMTP unavailable"));
    const req = {
      body: {
        email: "student@example.com",
        password: "Password1",
        name: "Student",
      },
    };
    const res = createMockResponse();

    await register(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body?.success).toBe(false);
    expect(res.body?.code).toBe("EMAIL_DELIVERY_FAILED");
    expect(userDeleteOneMock).toHaveBeenCalledWith({ _id: "user-123" });
    expect(res.cookies).toHaveLength(0);
  });

  it("accepts invited registration when invite token contains spaces instead of plus", async () => {
    const invitationDoc = {
      _id: "invite-1",
      token: "abc+def",
      email: "teacher@example.com",
      role: "teacher",
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    invitationFindOneMock.mockResolvedValueOnce(invitationDoc);

    const req = {
      body: {
        email: "teacher@example.com",
        password: "Password1",
        name: "Invited Teacher",
        inviteToken: "abc def",
      },
    };
    const res = createMockResponse();

    await register(req, res);

    expect(invitationFindOneMock).toHaveBeenCalledWith({
      token: { $in: ["abc def", "abc+def"] },
      status: "pending",
    });
    expect(cacheInvitationTokenMock).toHaveBeenCalledWith(invitationDoc);
    expect(deleteInvitationTokenMock).toHaveBeenCalledWith("abc+def");
    expect(res.statusCode).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(createdUsers[0]?.role).toBe("teacher");
    expect(createdUsers[0]?.isConfirmed).toBe(true);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("accepts invited registration when token is resolved from Redis record", async () => {
    getInvitationTokenRecordMock.mockResolvedValueOnce({
      token: "redis-token",
      invitationId: "invite-redis-1",
      email: "teacher@example.com",
      role: "teacher",
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    const invitationDoc = {
      _id: "invite-redis-1",
      email: "teacher@example.com",
      role: "teacher",
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    invitationFindOneMock.mockResolvedValueOnce(invitationDoc);

    const req = {
      body: {
        email: "teacher@example.com",
        password: "Password1",
        name: "Invited Teacher",
        inviteToken: "redis-token",
      },
    };
    const res = createMockResponse();

    await register(req, res);

    expect(getInvitationTokenRecordMock).toHaveBeenCalledWith(["redis-token"]);
    expect(invitationFindOneMock).toHaveBeenCalledWith({
      _id: "invite-redis-1",
      status: "pending",
    });
    expect(deleteInvitationTokenMock).toHaveBeenCalledWith("redis-token");
    expect(res.statusCode).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(createdUsers[0]?.role).toBe("teacher");
    expect(createdUsers[0]?.isConfirmed).toBe(true);
  });
});
