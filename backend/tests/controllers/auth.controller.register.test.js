import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const userFindOneMock = vi.fn();
const userDeleteOneMock = vi.fn();
const invitationFindOneMock = vi.fn();
const sendVerificationEmailMock = vi.fn();
const sendPasswordResetEmailMock = vi.fn();
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
  },
}));

vi.mock("../../services/email.service.js", () => ({
  sendVerificationEmail: sendVerificationEmailMock,
  sendPasswordResetEmail: sendPasswordResetEmailMock,
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
  sendVerificationEmailMock.mockResolvedValue(undefined);
  sendPasswordResetEmailMock.mockResolvedValue(undefined);
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
});
