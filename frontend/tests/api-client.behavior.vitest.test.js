import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createJwtToken = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
};

const loadApi = async () => {
  vi.resetModules();
  const { api } = await import("../src/shared/api/client.js");
  return api;
};

const requestEndsWith = (url, suffix) => String(url).endsWith(suffix);

describe("api client request behavior", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    delete window.__achievementUnlockQueue;
    delete window.__achievementToastReady;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("refreshes once on 401 and retries the original request", async () => {
    const api = await loadApi();
    const oldToken = createJwtToken({ exp: Math.floor(Date.now() / 1000) + 60, userId: "u1" });
    const newToken = createJwtToken({ exp: Math.floor(Date.now() / 1000) + 3600, userId: "u1" });

    api.setToken(oldToken);
    api.setUser({ _id: "u1", role: "student", isConfirmed: true });

    let testsCallCount = 0;
    global.fetch = vi.fn(async (url) => {
      if (requestEndsWith(url, "/api/tests")) {
        testsCallCount += 1;
        if (testsCallCount === 1) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ message: "Unauthorized" }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: ["ok"] }),
        };
      }

      if (requestEndsWith(url, "/api/auth/refresh")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              token: newToken,
              user: { _id: "u1", role: "student", isConfirmed: true },
            },
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const payload = await api.getTests();

    expect(payload).toEqual({ success: true, data: ["ok"] });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(api.getToken()).toBe(newToken);
  });

  it("clears local auth state when 401 refresh recovery fails", async () => {
    const api = await loadApi();
    const token = createJwtToken({ exp: Math.floor(Date.now() / 1000) + 60, userId: "u2" });

    api.setToken(token);
    api.setUser({ _id: "u2", role: "student", isConfirmed: true });
    window.history.pushState({}, "", "/login");

    global.fetch = vi.fn(async (url) => {
      if (requestEndsWith(url, "/api/tests")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ message: "Unauthorized" }),
        };
      }

      if (requestEndsWith(url, "/api/auth/refresh")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ message: "Refresh denied" }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    await expect(api.getTests()).rejects.toThrow("Unauthorized");
    expect(api.getToken()).toBeNull();
    expect(api.getUser()).toBeNull();
  });

  it("surfaces backend error messages from failed requests", async () => {
    const api = await loadApi();

    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: "Service unavailable" }),
    }));

    await expect(api.getTests()).rejects.toThrow("Service unavailable");
  });

  it("dispatches achievement events when response carries xp/achievement payload", async () => {
    const api = await loadApi();
    const token = createJwtToken({ exp: Math.floor(Date.now() / 1000) + 3600, userId: "u3" });

    api.setToken(token);
    api.setUser({ _id: "u3", role: "student", isConfirmed: true });
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    global.fetch = vi.fn(async (url) => {
      if (requestEndsWith(url, "/api/tests/test-1/submit")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              score: 1,
              total: 1,
              xpResult: { added: 10 },
              achievements: [{ title: "First win" }],
            },
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    await api.submitExam("test-1", { answers: ["A"] });

    const achievementEvents = dispatchSpy.mock.calls
      .map(([event]) => event)
      .filter((event) => event?.type === "achievements-unlocked");

    expect(achievementEvents).toHaveLength(1);
    expect(achievementEvents[0].detail).toEqual({
      achievements: [{ title: "First win" }],
      xpResult: { added: 10 },
    });
    expect(Array.isArray(window.__achievementUnlockQueue)).toBe(true);
    expect(window.__achievementUnlockQueue).toHaveLength(1);
  });
});
