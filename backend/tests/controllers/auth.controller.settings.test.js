import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const userFindByIdMock = vi.fn();
const userFindOneMock = vi.fn();
const bcryptCompareMock = vi.fn();
const bcryptGenSaltMock = vi.fn();
const bcryptHashMock = vi.fn();
const sendEmailChangeVerificationEmailMock = vi.fn();

vi.mock("../../models/User.model.js", () => ({
  default: {
    findById: userFindByIdMock,
    findOne: userFindOneMock,
  },
}));

vi.mock("../../models/Invitation.model.js", () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock("../../services/email.service.js", () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailChangeVerificationEmail: sendEmailChangeVerificationEmailMock,
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: bcryptCompareMock,
    genSalt: bcryptGenSaltMock,
    hash: bcryptHashMock,
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
    decode: vi.fn(),
    verify: vi.fn(),
  },
}));

const createSelectQuery = (value) => ({
  select: vi.fn().mockResolvedValue(value),
});

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    clearedCookies: [],
  };
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  res.cookie = () => res;
  res.clearCookie = (...args) => {
    res.clearedCookies.push(args);
    return res;
  };
  return res;
};

let changePassword;
let requestEmailChange;
let confirmEmailChange;

beforeAll(async () => {
  const module = await import("../../controllers/auth.controller.js");
  changePassword = module.changePassword;
  requestEmailChange = module.requestEmailChange;
  confirmEmailChange = module.confirmEmailChange;
});

beforeEach(() => {
  vi.clearAllMocks();
  bcryptCompareMock.mockResolvedValue(true);
  bcryptGenSaltMock.mockResolvedValue("salt");
  bcryptHashMock.mockResolvedValue("new-password-hash");
  sendEmailChangeVerificationEmailMock.mockResolvedValue({ messageId: "mail-1" });
});

describe("auth settings flows", () => {
  it("changePassword rejects incorrect current password", async () => {
    const user = {
      password: "current-hash",
      role: "teacher",
      save: vi.fn(),
    };
    userFindByIdMock.mockReturnValueOnce(createSelectQuery(user));
    bcryptCompareMock.mockResolvedValueOnce(false);

    const req = {
      user: { userId: "user-1" },
      body: {
        currentPassword: "WrongPassword1",
        newPassword: "NewPassword1",
      },
    };
    const res = createMockResponse();

    await changePassword(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error?.message).toBe("Current password is incorrect");
    expect(user.save).not.toHaveBeenCalled();
    expect(res.clearedCookies).toHaveLength(0);
  });

  it("changePassword updates password, revokes session state, and clears refresh cookie", async () => {
    const user = {
      password: "old-password-hash",
      role: "teacher",
      refreshTokenHash: "old-refresh-hash",
      refreshTokenIssuedAt: new Date(),
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      save: vi.fn().mockResolvedValue(undefined),
    };
    userFindByIdMock.mockReturnValueOnce(createSelectQuery(user));
    bcryptCompareMock
      .mockResolvedValueOnce(true) // current password matches
      .mockResolvedValueOnce(false); // new password is different

    const req = {
      user: { userId: "user-1" },
      body: {
        currentPassword: "CurrentPassword1",
        newPassword: "NewPassword1",
      },
    };
    const res = createMockResponse();

    await changePassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(user.password).toBe("new-password-hash");
    expect(user.refreshTokenHash).toBeNull();
    expect(user.refreshTokenIssuedAt).toBeNull();
    expect(user.refreshTokenExpiresAt).toBeNull();
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(res.clearedCookies).toHaveLength(1);
  });

  it("requestEmailChange persists pending state and sends verification email", async () => {
    const user = {
      _id: "user-1",
      email: "teacher@example.com",
      password: "current-hash",
      save: vi.fn().mockResolvedValue(undefined),
    };
    userFindByIdMock.mockReturnValueOnce(createSelectQuery(user));
    userFindOneMock.mockReturnValueOnce(createSelectQuery(null));

    const req = {
      user: { userId: "user-1" },
      body: {
        newEmail: "new.teacher@example.com",
        currentPassword: "CurrentPassword1",
      },
    };
    const res = createMockResponse();

    await requestEmailChange(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(user.pendingEmail).toBe("new.teacher@example.com");
    expect(typeof user.emailChangeTokenHash).toBe("string");
    expect(user.emailChangeTokenHash.length).toBe(64);
    expect(user.emailChangeTokenExpires).toBeInstanceOf(Date);
    expect(sendEmailChangeVerificationEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailChangeVerificationEmailMock.mock.calls[0][0]).toBe("new.teacher@example.com");
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  it("requestEmailChange rolls back pending state when email delivery fails", async () => {
    const user = {
      _id: "user-1",
      email: "teacher@example.com",
      password: "current-hash",
      save: vi.fn().mockResolvedValue(undefined),
    };
    userFindByIdMock.mockReturnValueOnce(createSelectQuery(user));
    userFindOneMock.mockReturnValueOnce(createSelectQuery(null));
    sendEmailChangeVerificationEmailMock.mockResolvedValueOnce(null);

    const req = {
      user: { userId: "user-1" },
      body: {
        newEmail: "new.teacher@example.com",
        currentPassword: "CurrentPassword1",
      },
    };
    const res = createMockResponse();

    await requestEmailChange(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error?.message).toBe("Could not send verification email. Please try again.");
    expect(user.pendingEmail).toBeNull();
    expect(user.emailChangeTokenHash).toBeNull();
    expect(user.emailChangeTokenExpires).toBeNull();
    expect(user.save).toHaveBeenCalledTimes(2);
  });

  it("confirmEmailChange rejects invalid token", async () => {
    userFindOneMock.mockResolvedValueOnce(null);

    const req = { body: { token: "invalid-token" } };
    const res = createMockResponse();

    await confirmEmailChange(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error?.message).toBe("Invalid or expired token");
    expect(res.clearedCookies).toHaveLength(0);
  });

  it("confirmEmailChange updates email, clears pending fields, and revokes sessions", async () => {
    const user = {
      _id: "user-1",
      role: "teacher",
      email: "old@example.com",
      pendingEmail: "new@example.com",
      emailChangeTokenHash: "token-hash",
      emailChangeTokenExpires: new Date(Date.now() + 60_000),
      refreshTokenHash: "old-refresh-token-hash",
      refreshTokenIssuedAt: new Date(),
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      save: vi.fn().mockResolvedValue(undefined),
    };
    userFindOneMock.mockResolvedValueOnce(user);
    userFindOneMock.mockReturnValueOnce(createSelectQuery(null));

    const req = { body: { token: "valid-token" } };
    const res = createMockResponse();

    await confirmEmailChange(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(user.email).toBe("new@example.com");
    expect(user.pendingEmail).toBeNull();
    expect(user.emailChangeTokenHash).toBeNull();
    expect(user.emailChangeTokenExpires).toBeNull();
    expect(user.refreshTokenHash).toBeNull();
    expect(user.refreshTokenIssuedAt).toBeNull();
    expect(user.refreshTokenExpiresAt).toBeNull();
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(res.clearedCookies).toHaveLength(1);
  });
});
