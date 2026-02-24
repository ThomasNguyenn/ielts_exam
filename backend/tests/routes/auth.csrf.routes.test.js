import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
  process.env.FRONTEND_ORIGINS = process.env.FRONTEND_ORIGINS || "http://localhost:5173";
  const { createApp } = await import("../../app.js");
  app = createApp({ startBackgroundJobs: false });
});

describe("auth cookie CSRF protection", () => {
  it("blocks refresh requests with cookie but missing origin", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", ["lr_refresh=dummy-token"]);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("CSRF_ORIGIN_REQUIRED");
  });

  it("blocks refresh requests from untrusted origins", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Referer", "https://evil.example/login")
      .set("Cookie", ["lr_refresh=dummy-token"]);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("CSRF_ORIGIN_DENIED");
  });

  it("allows trusted origins to reach refresh handler", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", ["lr_refresh=dummy-token"]);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("blocks logout requests with cookie but missing origin", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", ["lr_refresh=dummy-token"]);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("CSRF_ORIGIN_REQUIRED");
  });
});
