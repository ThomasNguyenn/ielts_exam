import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheStore = vi.hoisted(() => new Map());
const tagStore = vi.hoisted(() => new Map());

const cacheMocks = vi.hoisted(() => ({
  getJson: vi.fn(async (key) => cacheStore.get(key) || null),
  setJson: vi.fn(async (key, value) => {
    cacheStore.set(key, value);
    return true;
  }),
  addKeyToTags: vi.fn(async (key, tags = []) => {
    tags.forEach((tag) => {
      const normalizedTag = String(tag || "").trim();
      if (!normalizedTag) return;
      const set = tagStore.get(normalizedTag) || new Set();
      set.add(key);
      tagStore.set(normalizedTag, set);
    });
    return true;
  }),
  invalidateTags: vi.fn(async (tags = []) => {
    tags.forEach((tag) => {
      const normalizedTag = String(tag || "").trim();
      const set = tagStore.get(normalizedTag);
      if (!set) return;
      set.forEach((cacheKey) => cacheStore.delete(cacheKey));
      tagStore.delete(normalizedTag);
    });
    return true;
  }),
}));

vi.mock("../../services/responseCache.redis.js", () => cacheMocks);

const createMockReq = ({
  method = "GET",
  baseUrl = "/api/tests",
  path = "/",
  query = {},
  user = null,
} = {}) => ({
  method,
  baseUrl,
  path,
  query,
  user,
});

const createMockRes = () => {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    body: null,
    set(key, value) {
      headers[String(key)] = String(value);
      return this;
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

describe("response cache middleware", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    cacheStore.clear();
    tagStore.clear();
    process.env.API_RESPONSE_CACHE_ENABLED = "true";
    process.env.API_RESPONSE_CACHE_DEFAULT_TTL_SEC = "120";
    process.env.API_RESPONSE_CACHE_MAX_PAYLOAD_BYTES = "1048576";
    process.env.API_RESPONSE_CACHE_IGNORE_QUERY_KEYS = "_t,ts,timestamp,_cacheBuster";
  });

  it("returns MISS first and HIT on subsequent request", async () => {
    const { createResponseCache } = await import("../../middleware/responseCache.middleware.js");
    const middleware = createResponseCache({ namespace: "tests-catalog", ttlSec: 180, tags: ["catalog:tests"] });

    const req1 = createMockReq({ query: { page: "1" } });
    const res1 = createMockRes();
    const next1 = vi.fn();

    await middleware(req1, res1, next1);
    expect(next1).toHaveBeenCalledTimes(1);
    expect(res1.headers["X-Cache"]).toBe("MISS");
    res1.json({ success: true, value: 1 });
    await Promise.resolve();

    const req2 = createMockReq({ query: { page: "1" } });
    const res2 = createMockRes();
    const next2 = vi.fn();

    await middleware(req2, res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.headers["X-Cache"]).toBe("HIT");
    expect(res2.body).toEqual({ success: true, value: 1 });
  });

  it("bypasses non-GET requests", async () => {
    const { createResponseCache } = await import("../../middleware/responseCache.middleware.js");
    const middleware = createResponseCache({ namespace: "tests-catalog" });

    const req = createMockReq({ method: "POST" });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headers["X-Cache"]).toBe("BYPASS");
  });

  it("does not cache non-200 responses", async () => {
    const { createResponseCache } = await import("../../middleware/responseCache.middleware.js");
    const middleware = createResponseCache({ namespace: "tests-errors" });

    const req1 = createMockReq({ query: { q: "fail" } });
    const res1 = createMockRes();
    const next1 = vi.fn();

    await middleware(req1, res1, next1);
    res1.status(500).json({ success: false });
    await Promise.resolve();

    const req2 = createMockReq({ query: { q: "fail" } });
    const res2 = createMockRes();
    const next2 = vi.fn();

    await middleware(req2, res2, next2);
    expect(next2).toHaveBeenCalledTimes(1);
    expect(res2.headers["X-Cache"]).toBe("MISS");
  });

  it("normalizes query key/value ordering and ignores _t cache buster", async () => {
    const { createResponseCache } = await import("../../middleware/responseCache.middleware.js");
    const middleware = createResponseCache({ namespace: "tests-query" });

    const req1 = createMockReq({ query: { b: "2", _t: "111", a: "1" } });
    const res1 = createMockRes();
    const next1 = vi.fn();

    await middleware(req1, res1, next1);
    res1.json({ success: true, value: "normalized" });
    await Promise.resolve();

    const req2 = createMockReq({ query: { a: "1", b: "2", _t: "999" } });
    const res2 = createMockRes();
    const next2 = vi.fn();

    await middleware(req2, res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.headers["X-Cache"]).toBe("HIT");
    expect(res2.body).toEqual({ success: true, value: "normalized" });
  });

  it("separates cache key by user scope", async () => {
    const { createResponseCache } = await import("../../middleware/responseCache.middleware.js");
    const middleware = createResponseCache({ namespace: "leaderboard-me", scope: "user" });

    const req1 = createMockReq({
      baseUrl: "/api",
      path: "/leaderboard/me",
      user: { userId: "u1", role: "student" },
    });
    const res1 = createMockRes();
    const next1 = vi.fn();
    await middleware(req1, res1, next1);
    res1.json({ success: true, rank: 1 });
    await Promise.resolve();

    const req2 = createMockReq({
      baseUrl: "/api",
      path: "/leaderboard/me",
      user: { userId: "u2", role: "student" },
    });
    const res2 = createMockRes();
    const next2 = vi.fn();
    await middleware(req2, res2, next2);

    expect(next2).toHaveBeenCalledTimes(1);
    expect(res2.headers["X-Cache"]).toBe("MISS");
  });

  it("bypasses cache for payload larger than configured max bytes", async () => {
    process.env.API_RESPONSE_CACHE_MAX_PAYLOAD_BYTES = "30";
    const { createResponseCache } = await import("../../middleware/responseCache.middleware.js");
    const middleware = createResponseCache({ namespace: "oversized" });

    const req1 = createMockReq({ query: { page: "1" } });
    const res1 = createMockRes();
    const next1 = vi.fn();
    await middleware(req1, res1, next1);
    res1.json({ success: true, text: "This payload is definitely larger than 30 bytes." });
    await Promise.resolve();
    expect(res1.headers["X-Cache"]).toBe("BYPASS");

    const req2 = createMockReq({ query: { page: "1" } });
    const res2 = createMockRes();
    const next2 = vi.fn();
    await middleware(req2, res2, next2);
    expect(next2).toHaveBeenCalledTimes(1);
    expect(res2.headers["X-Cache"]).toBe("MISS");
  });
});
