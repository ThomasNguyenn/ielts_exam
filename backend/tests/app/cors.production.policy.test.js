import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  FRONTEND_ORIGINS: process.env.FRONTEND_ORIGINS,
  CORS_ALLOW_NO_ORIGIN: process.env.CORS_ALLOW_NO_ORIGIN,
  SEED_ACHIEVEMENTS_ON_BOOT: process.env.SEED_ACHIEVEMENTS_ON_BOOT,
};

const restoreEnvValue = (key, value) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
};

const buildProductionApp = async (overrides = {}) => {
  process.env.NODE_ENV = "production";
  process.env.FRONTEND_ORIGINS = "https://app.example.com";
  process.env.CORS_ALLOW_NO_ORIGIN = "";
  process.env.SEED_ACHIEVEMENTS_ON_BOOT = "false";

  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }

  vi.resetModules();
  const { createApp } = await import("../../app.js");
  return createApp({ startBackgroundJobs: false });
};

beforeEach(() => {
  restoreEnvValue("NODE_ENV", ORIGINAL_ENV.NODE_ENV);
  restoreEnvValue("FRONTEND_ORIGINS", ORIGINAL_ENV.FRONTEND_ORIGINS);
  restoreEnvValue("CORS_ALLOW_NO_ORIGIN", ORIGINAL_ENV.CORS_ALLOW_NO_ORIGIN);
  restoreEnvValue("SEED_ACHIEVEMENTS_ON_BOOT", ORIGINAL_ENV.SEED_ACHIEVEMENTS_ON_BOOT);
});

afterEach(() => {
  restoreEnvValue("NODE_ENV", ORIGINAL_ENV.NODE_ENV);
  restoreEnvValue("FRONTEND_ORIGINS", ORIGINAL_ENV.FRONTEND_ORIGINS);
  restoreEnvValue("CORS_ALLOW_NO_ORIGIN", ORIGINAL_ENV.CORS_ALLOW_NO_ORIGIN);
  restoreEnvValue("SEED_ACHIEVEMENTS_ON_BOOT", ORIGINAL_ENV.SEED_ACHIEVEMENTS_ON_BOOT);
});

describe("production CORS policy", () => {
  it("rejects requests without Origin by default", async () => {
    const app = await buildProductionApp();
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("CORS_ORIGIN_REQUIRED");
  }, 15000);

  it("allows requests without Origin when CORS_ALLOW_NO_ORIGIN is explicitly enabled", async () => {
    const app = await buildProductionApp({ CORS_ALLOW_NO_ORIGIN: "true" });
    const res = await request(app).get("/api/health");

    expect(res.status).not.toBe(403);
  }, 15000);

  it("allows requests without Origin when Authorization header is present", async () => {
    const app = await buildProductionApp();
    const res = await request(app)
      .get("/api/health")
      .set("Authorization", "Bearer test.access.token");

    expect(res.status).not.toBe(403);
  }, 15000);

  it("allows configured production origins", async () => {
    const app = await buildProductionApp();
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "https://app.example.com");

    expect(res.status).not.toBe(403);
  }, 15000);
});
