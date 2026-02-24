import { createHash } from "crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const userFindOneMock = vi.fn();
const userFindByIdMock = vi.fn();
const userFindByIdAndUpdateMock = vi.fn();
const bcryptCompareMock = vi.fn();
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
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: bcryptCompareMock,
    genSalt: vi.fn(),
    hash: vi.fn(),
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

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    cookies: [],
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
  res.cookie = (...args) => {
    res.cookies.push(args);
    return res;
  };
  res.clearCookie = (...args) => {
    res.clearedCookies.push(args);
    return res;
  };
  return res;
};

let login;
let refreshAccessToken;
let logout;

beforeAll(async () => {
  const module = await import("../../controllers/auth.controller.js");
  login = module.login;
  refreshAccessToken = module.refreshAccessToken;
  logout = module.logout;
});

beforeEach(() => {
  vi.clearAllMocks();
  bcryptCompareMock.mockResolvedValue(true);
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
});

describe("auth session flows", () => {
  it("login issues access/refresh tokens and sets refresh cookie", async () => {
    const user = {
      _id: "user-1",
      email: "student@example.com",
      name: "Student",
      role: "student",
      isConfirmed: true,
      password: "hashed-password",
      save: vi.fn().mockResolvedValue(undefined),
    };
    userFindOneMock.mockResolvedValue(user);

    const req = {
      body: {
        email: "student@example.com",
        password: "Password1",
      },
    };
    const res = createMockResponse();

    await login(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.token).toBe("access.jwt.token");
    expect(res.cookies).toHaveLength(1);
    expect(res.cookies[0]?.[0]).toBe("lr_refresh");
    expect(res.cookies[0]?.[1]).toBe("refresh.jwt.token");
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(user.refreshTokenHash).toBe(hashToken("refresh.jwt.token"));
    expect(user.refreshTokenExpiresAt).toBeInstanceOf(Date);
    expect(typeof user.activeSessionId).toBe("string");
  });

  it("refresh returns 401 and clears cookie when refresh token is missing", async () => {
    const req = { headers: {} };
    const res = createMockResponse();

    await refreshAccessToken(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error?.message).toBe("Refresh token missing");
    expect(res.clearedCookies).toHaveLength(1);
  });

  it("refresh rotates refresh token and returns new access token for a valid session", async () => {
    const currentRefresh = "current.refresh.token";
    const user = {
      _id: "user-1",
      email: "student@example.com",
      name: "Student",
      role: "student",
      isConfirmed: true,
      activeSessionId: "session-1",
      refreshTokenHash: hashToken(currentRefresh),
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      save: vi.fn().mockResolvedValue(undefined),
    };

    jwtVerifyMock.mockReturnValue({
      tokenType: "refresh",
      userId: "user-1",
      role: "student",
      sessionId: "session-1",
    });
    jwtSignMock.mockImplementation((payload) =>
      payload?.tokenType === "access" ? "next.access.token" : "next.refresh.token",
    );
    userFindByIdMock.mockResolvedValue(user);

    const req = { headers: { cookie: `lr_refresh=${encodeURIComponent(currentRefresh)}` } };
    const res = createMockResponse();

    await refreshAccessToken(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.token).toBe("next.access.token");
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(user.refreshTokenHash).toBe(hashToken("next.refresh.token"));
    expect(res.cookies).toHaveLength(1);
    expect(res.cookies[0]?.[1]).toBe("next.refresh.token");
  });

  it("logout revokes refresh token and clears cookie", async () => {
    const req = { headers: { cookie: "lr_refresh=refresh.logout.token" } };
    const res = createMockResponse();

    jwtVerifyMock.mockReturnValue({
      tokenType: "refresh",
      userId: "user-1",
      role: "student",
    });

    await logout(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toBe("Logged out");
    expect(res.clearedCookies).toHaveLength(1);
    expect(userFindByIdAndUpdateMock).toHaveBeenCalledTimes(1);

    const [, update] = userFindByIdAndUpdateMock.mock.calls[0];
    expect(update.$set).toMatchObject({
      refreshTokenHash: null,
      refreshTokenIssuedAt: null,
      refreshTokenExpiresAt: null,
    });
    expect(typeof update.$set.activeSessionId).toBe("string");
    expect(update.$set.activeSessionIssuedAt).toBeInstanceOf(Date);
  });
});
