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
  const dispatchEvents = [];

  global.window = {
    sessionStorage,
    localStorage,
    location: { pathname: "/" },
    dispatchEvent: (event) => dispatchEvents.push(event),
  };

  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };

  return { sessionStorage, localStorage, dispatchEvents };
};

test("bootstrapSession restores access token from refresh cookie", async () => {
  const { sessionStorage } = installWindowMocks();
  const { api } = await import("../src/shared/api/client.js");

  api.removeToken();
  api.removeUser();

  const futureExp = Math.floor(Date.now() / 1000) + 3600;
  const token = createJwtToken({ exp: futureExp, userId: "u1" });
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: {
        token,
        user: { _id: "u1", role: "student", isConfirmed: true },
      },
    }),
  });

  const refreshed = await api.bootstrapSession();

  assert.equal(refreshed, true);
  assert.equal(sessionStorage.getItem("token"), token);
  assert.equal(api.isAuthenticated(), true);

  delete global.fetch;
  delete global.CustomEvent;
  delete global.window;
});

test("bootstrapSession clears stale local auth when refresh fails", async () => {
  const { sessionStorage } = installWindowMocks();
  const { api } = await import("../src/shared/api/client.js");

  sessionStorage.setItem("token", "stale.token.value");
  sessionStorage.setItem("user", JSON.stringify({ _id: "u1", role: "student", isConfirmed: true }));

  global.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ success: false }),
  });

  const refreshed = await api.bootstrapSession();

  assert.equal(refreshed, false);
  assert.equal(sessionStorage.getItem("token"), null);
  assert.equal(sessionStorage.getItem("user"), null);
  assert.equal(api.isAuthenticated(), false);

  delete global.fetch;
  delete global.CustomEvent;
  delete global.window;
});
