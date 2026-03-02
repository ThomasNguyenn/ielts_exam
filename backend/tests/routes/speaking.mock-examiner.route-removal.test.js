import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
  process.env.FRONTEND_ORIGINS = process.env.FRONTEND_ORIGINS || "http://localhost:5173";
  const { createApp } = await import("../../app.js");
  app = createApp({ startBackgroundJobs: false });
});

describe("speaking route removal", () => {
  it("returns 404 for removed mock examiner endpoint", async () => {
    const res = await request(app)
      .post("/api/speaking/sessions/session-1/mock-examiner/turn")
      .set("Origin", "http://localhost:5173")
      .send({ userAnswer: "test answer" });

    expect(res.status).toBe(404);
  });
});
