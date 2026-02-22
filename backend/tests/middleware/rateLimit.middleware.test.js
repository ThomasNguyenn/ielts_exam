import { describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "../../middleware/rateLimit.middleware.js";

const createMockRes = () => {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    body: null,
    setHeader(key, value) {
      headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
};

describe("createRateLimiter", () => {
  it("allows requests until the max, then blocks with 429", () => {
    const limiter = createRateLimiter({
      windowMs: 10_000,
      max: 2,
      keyGenerator: () => "fixed-client",
    });

    const req = { method: "GET", ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } };

    const next1 = vi.fn();
    const res1 = createMockRes();
    limiter(req, res1, next1);
    expect(next1).toHaveBeenCalledTimes(1);
    expect(res1.statusCode).toBe(200);

    const next2 = vi.fn();
    const res2 = createMockRes();
    limiter(req, res2, next2);
    expect(next2).toHaveBeenCalledTimes(1);
    expect(res2.statusCode).toBe(200);

    const next3 = vi.fn();
    const res3 = createMockRes();
    limiter(req, res3, next3);
    expect(next3).not.toHaveBeenCalled();
    expect(res3.statusCode).toBe(429);
    expect(res3.body?.success).toBe(false);
    expect(res3.body?.error?.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("skips rate limiting for OPTIONS preflight", () => {
    const limiter = createRateLimiter({ max: 1, keyGenerator: () => "fixed-client" });
    const req = { method: "OPTIONS", ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } };
    const res = createMockRes();
    const next = vi.fn();

    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeNull();
  });
});
