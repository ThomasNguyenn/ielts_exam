import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const userFindOneMock = vi.fn();
const sendPasswordResetEmailMock = vi.fn();
const bcryptGenSaltMock = vi.fn();
const bcryptHashMock = vi.fn();

vi.mock("../../models/User.model.js", () => ({
  default: {
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
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
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

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
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
  res.clearCookie = () => res;
  return res;
};

let forgotPassword;
let resetPassword;

beforeAll(async () => {
  const module = await import("../../controllers/auth.controller.js");
  forgotPassword = module.forgotPassword;
  resetPassword = module.resetPassword;
});

beforeEach(() => {
  vi.clearAllMocks();
  userFindOneMock.mockResolvedValue(null);
  sendPasswordResetEmailMock.mockResolvedValue(undefined);
  bcryptGenSaltMock.mockResolvedValue("salt");
  bcryptHashMock.mockResolvedValue("new-hash");
});

describe("auth password recovery flows", () => {
  it("forgotPassword returns generic success for unknown email", async () => {
    const req = { body: { email: "missing@example.com" } };
    const res = createMockResponse();

    await forgotPassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toBe("If an account exists, a reset email has been sent.");
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("forgotPassword stores hashed reset token and sends reset email", async () => {
    const user = {
      email: "student@example.com",
      save: vi.fn().mockResolvedValue(undefined),
    };
    userFindOneMock.mockResolvedValue(user);

    const req = { body: { email: "student@example.com" } };
    const res = createMockResponse();

    await forgotPassword(req, res);

    expect(user.save).toHaveBeenCalledTimes(1);
    expect(typeof user.resetPasswordToken).toBe("string");
    expect(typeof user.resetPasswordExpires).toBe("number");
    expect(user.resetPasswordExpires).toBeGreaterThan(Date.now());
    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmailMock.mock.calls[0]?.[0]).toBe("student@example.com");

    const plaintextToken = sendPasswordResetEmailMock.mock.calls[0]?.[1];
    expect(typeof plaintextToken).toBe("string");
    expect(plaintextToken.length).toBeGreaterThan(0);
    expect(plaintextToken).not.toBe(user.resetPasswordToken);
    expect(res.body?.success).toBe(true);
  });

  it("resetPassword returns 400 for invalid or expired token", async () => {
    userFindOneMock.mockReturnValue({
      or: vi.fn().mockResolvedValue(null),
    });

    const req = {
      body: {
        token: "invalid-token",
        newPassword: "Password1",
      },
    };
    const res = createMockResponse();

    await resetPassword(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error?.message).toBe("Invalid or expired token");
    expect(bcryptHashMock).not.toHaveBeenCalled();
  });

  it("resetPassword updates password and revokes existing refresh session", async () => {
    const user = {
      role: "student",
      save: vi.fn().mockResolvedValue(undefined),
      refreshTokenHash: "old-hash",
      refreshTokenIssuedAt: new Date(),
      refreshTokenExpiresAt: new Date(Date.now() + 30_000),
    };
    userFindOneMock.mockReturnValue({
      or: vi.fn().mockResolvedValue(user),
    });

    const req = {
      body: {
        token: "valid-reset-token",
        newPassword: "Password1",
      },
    };
    const res = createMockResponse();

    await resetPassword(req, res);

    expect(bcryptGenSaltMock).toHaveBeenCalledWith(10);
    expect(bcryptHashMock).toHaveBeenCalledWith("Password1", "salt");
    expect(user.password).toBe("new-hash");
    expect(user.resetPasswordToken).toBeUndefined();
    expect(user.resetPasswordExpires).toBeUndefined();
    expect(user.refreshTokenHash).toBeNull();
    expect(user.refreshTokenIssuedAt).toBeNull();
    expect(user.refreshTokenExpiresAt).toBeNull();
    expect(typeof user.activeSessionId).toBe("string");
    expect(user.activeSessionIssuedAt).toBeInstanceOf(Date);
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toBe("Password reset successfully");
  });
});
