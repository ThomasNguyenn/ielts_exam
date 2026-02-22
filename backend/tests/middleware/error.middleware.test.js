import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { normalizeErrorResponse, notFoundHandler } from "../../middleware/error.middleware.js";

const buildTestApp = () => {
  const app = express();
  app.use((req, res, next) => {
    req.requestId = "test-request-id";
    next();
  });
  app.use(normalizeErrorResponse);
  return app;
};

describe("error middleware", () => {
  it("normalizes non-standard error payloads", async () => {
    const app = buildTestApp();
    app.get("/boom", (req, res) => {
      res.status(500).json({ message: "Something failed" });
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      requestId: "test-request-id",
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something failed",
      },
    });
  });

  it("passes through already normalized error payloads", async () => {
    const app = buildTestApp();
    app.get("/normalized", (req, res) => {
      res.status(400).json({
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Invalid data",
        },
      });
    });

    const res = await request(app).get("/normalized");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.error.message).toBe("Invalid data");
  });

  it("returns 404 payload from notFoundHandler", async () => {
    const app = buildTestApp();
    app.use(notFoundHandler);

    const res = await request(app).get("/unknown-route");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
