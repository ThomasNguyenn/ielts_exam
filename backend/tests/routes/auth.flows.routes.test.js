import { createHash } from "crypto";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const userFindOneMock = vi.fn();
const userFindByIdMock = vi.fn();
const userFindByIdAndUpdateMock = vi.fn();
const sendPasswordResetEmailMock = vi.fn();
const bcryptCompareMock = vi.fn();
const bcryptGenSaltMock = vi.fn();
const bcryptHashMock = vi.fn();
const jwtSignMock = vi.fn();
const jwtDecodeMock = vi.fn();
const jwtVerifyMock = vi.fn();

vi.mock("../../models/User.model.js", () => ({
  default: {
    findOne: userFindOneMock,
    findById: userFindByIdMock,
    findByIdAndUpdate: userFindByIdAndUpdateMock,
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
    compare: bcryptCompareMock,
    genSalt: bcryptGenSaltMock,
    hash: bcryptHashMock,
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: jwtSignMock,
    decode: jwtDecodeMock,
    verify: jwtVerifyMock,
  },
}));

const hashToken = (token) =>
  createHash("sha256").update(String(token || ""), "utf8").digest("hex");

const createUserDoc = (overrides = {}) => ({
  _id: "user-1",
  email: "student@example.com",
  name: "Student",
  role: "student",
  isConfirmed: true,
  password: "hashed-password",
  refreshTokenHash: null,
  refreshTokenIssuedAt: null,
  refreshTokenExpiresAt: null,
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
  process.env.FRONTEND_ORIGINS = process.env.FRONTEND_ORIGINS || "http://localhost:5173";
  const { createApp } = await import("../../app.js");
  app = createApp({ startBackgroundJobs: false });
});

beforeEach(() => {
  vi.clearAllMocks();

  jwtDecodeMock.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
  jwtSignMock.mockImplementation((payload) =>
    payload?.tokenType === "access" ? "access.jwt.token" : "refresh.jwt.token",
  );
  jwtVerifyMock.mockReturnValue({
    tokenType: "refresh",
    userId: "user-1",
    role: "student",
    sessionId: "session-1",
  });
  bcryptCompareMock.mockResolvedValue(true);
  bcryptGenSaltMock.mockResolvedValue("salt");
  bcryptHashMock.mockResolvedValue("new-password-hash");
  sendPasswordResetEmailMock.mockResolvedValue(undefined);

  userFindOneMock.mockResolvedValue(null);
  userFindByIdMock.mockResolvedValue(null);
  userFindByIdAndUpdateMock.mockResolvedValue({ _id: "user-1" });
});

describe("auth route integration flows", () => {
  it("POST /api/auth/login returns tokens and sets refresh cookie", async () => {
    userFindOneMock.mockResolvedValue(
      createUserDoc({
        role: "student",
      }),
    );

    const res = await request(app).post("/api/auth/login").send({
      email: "student@example.com",
      password: "Password1",
    });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.token).toBe("access.jwt.token");
    expect(res.headers["set-cookie"]?.[0]).toContain("lr_refresh=refresh.jwt.token");
  });

  it("POST /api/auth/refresh rotates refresh cookie and returns a new access token", async () => {
    const currentRefreshToken = "current.refresh.token";
    const user = createUserDoc({
      activeSessionId: "session-1",
      refreshTokenHash: hashToken(currentRefreshToken),
      refreshTokenExpiresAt: new Date(Date.now() + 30_000),
    });
    userFindByIdMock.mockResolvedValue(user);
    jwtSignMock.mockImplementation((payload) =>
      payload?.tokenType === "access" ? "next.access.token" : "next.refresh.token",
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", [`lr_refresh=${encodeURIComponent(currentRefreshToken)}`]);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.token).toBe("next.access.token");
    expect(res.headers["set-cookie"]?.[0]).toContain("lr_refresh=next.refresh.token");
  });

  it("POST /api/auth/logout clears cookie and revokes active refresh session", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", ["lr_refresh=refresh.logout.token"]);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toBe("Logged out");
    expect(userFindByIdAndUpdateMock).toHaveBeenCalledTimes(1);
  });

  it("POST /api/auth/forgot-password returns generic success when account is missing", async () => {
    userFindOneMock.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/forgot-password").send({
      email: "missing@example.com",
    });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toBe("If an account exists, a reset email has been sent.");
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("POST /api/auth/forgot-password stores reset token hash and sends email", async () => {
    const user = createUserDoc();
    userFindOneMock.mockResolvedValue(user);

    const res = await request(app).post("/api/auth/forgot-password").send({
      email: "student@example.com",
    });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(typeof user.resetPasswordToken).toBe("string");
    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmailMock.mock.calls[0][0]).toBe("student@example.com");
  });

  it("POST /api/auth/reset-password returns 400 when token is invalid", async () => {
    userFindOneMock.mockReturnValue({
      or: vi.fn().mockResolvedValue(null),
    });

    const res = await request(app).post("/api/auth/reset-password").send({
      token: "invalid-token",
      newPassword: "Password1",
    });

    expect(res.status).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error?.message).toBe("Invalid or expired token");
  });

  it("POST /api/auth/reset-password updates password and revokes existing refresh state", async () => {
    const user = createUserDoc({
      refreshTokenHash: "old-refresh-hash",
      refreshTokenIssuedAt: new Date(),
      refreshTokenExpiresAt: new Date(Date.now() + 30_000),
    });
    userFindOneMock.mockReturnValue({
      or: vi.fn().mockResolvedValue(user),
    });

    const res = await request(app).post("/api/auth/reset-password").send({
      token: "valid-token",
      newPassword: "Password1",
    });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toBe("Password reset successfully");
    expect(user.password).toBe("new-password-hash");
    expect(user.refreshTokenHash).toBeNull();
    expect(user.refreshTokenIssuedAt).toBeNull();
    expect(user.refreshTokenExpiresAt).toBeNull();
    expect(user.save).toHaveBeenCalledTimes(1);
  });
});
