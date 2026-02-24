import test from "node:test";
import assert from "node:assert/strict";

const createStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

const createJwtToken = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
};

const installWindowMocks = () => {
  const sessionStorage = createStorage();
  const localStorage = createStorage();
  const dispatchedEvents = [];

  global.window = {
    sessionStorage,
    localStorage,
    location: { pathname: "/", href: "/" },
    dispatchEvent: (event) => dispatchedEvents.push(event),
  };

  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };

  return { sessionStorage, localStorage, dispatchedEvents };
};

const cleanupGlobals = () => {
  delete global.fetch;
  delete global.CustomEvent;
  delete global.window;
};

test("login flow: calls auth login endpoint and persists token/user session", async () => {
  try {
    const { sessionStorage } = installWindowMocks();
    const { api } = await import("../src/shared/api/client.js");

    api.removeToken();
    api.removeUser();

    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = createJwtToken({ exp: futureExp, userId: "u1" });
    const user = { _id: "u1", role: "student", isConfirmed: true };
    const calls = [];

    global.fetch = async (url, options = {}) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token, user },
        }),
      };
    };

    const payload = await api.login({
      email: "student@example.com",
      password: "Password1",
    });
    api.setToken(payload.data.token);
    api.setUser(payload.data.user);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/auth/login");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(JSON.parse(calls[0].options.body).email, "student@example.com");
    assert.equal(sessionStorage.getItem("token"), token);
    assert.deepEqual(api.getUser(), user);
    assert.equal(api.isAuthenticated(), true);
  } finally {
    cleanupGlobals();
  }
});

test("logout flow: calls logout endpoint and clears local auth session", async () => {
  try {
    const { sessionStorage } = installWindowMocks();
    const { api } = await import("../src/shared/api/client.js");

    const token = createJwtToken({ exp: Math.floor(Date.now() / 1000) + 3600, userId: "u1" });
    api.setToken(token);
    api.setUser({ _id: "u1", role: "student", isConfirmed: true });

    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    };

    await api.logout();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/auth/logout");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(sessionStorage.getItem("token"), null);
    assert.equal(sessionStorage.getItem("user"), null);
    assert.equal(api.getToken(), null);
    assert.equal(api.getUser(), null);
    assert.equal(api.isAuthenticated(), false);
  } finally {
    cleanupGlobals();
  }
});

test("basic exam path: getExam and submitExam use expected endpoints and auth header", async () => {
  try {
    installWindowMocks();
    const { api } = await import("../src/shared/api/client.js");

    const token = createJwtToken({ exp: Math.floor(Date.now() / 1000) + 3600, userId: "u2" });
    api.setToken(token);
    api.setUser({ _id: "u2", role: "student", isConfirmed: true });

    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url, options });

      if (url === "/api/tests/test-1/exam") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { testId: "test-1", type: "reading" } }),
        };
      }

      if (url === "/api/tests/test-1/submit") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { score: 1, total: 1 } }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const examPayload = await api.getExam("test-1");
    const submitPayload = await api.submitExam("test-1", { answers: ["A"] });

    assert.equal(examPayload.success, true);
    assert.equal(submitPayload.success, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "/api/tests/test-1/exam");
    assert.equal(calls[0].options.headers.Authorization, `Bearer ${token}`);
    assert.equal(calls[1].url, "/api/tests/test-1/submit");
    assert.equal(calls[1].options.method, "POST");
    assert.equal(calls[1].options.headers.Authorization, `Bearer ${token}`);
    assert.deepEqual(JSON.parse(calls[1].options.body), { answers: ["A"] });
  } finally {
    cleanupGlobals();
  }
});
