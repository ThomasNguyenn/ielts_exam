import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
  const { createApp } = await import("../../app.js");
  app = createApp({ startBackgroundJobs: false });
});

describe("app smoke tests", () => {
  it("exposes /api/health with degraded status when DB is disconnected", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.requestId).toBe("string");
    expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(typeof res.body.error.message).toBe("string");
  });

  it("exposes /api/health/db endpoint", async () => {
    const res = await request(app).get("/api/health/db");

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.requestId).toBe("string");
    expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(typeof res.body.error.message).toBe("string");
  });

  it("returns normalized 404 payload for unknown routes", async () => {
    const res = await request(app).get("/api/route-that-does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
