import { describe, expect, it, vi, afterEach } from "vitest";
import { handleControllerError, sendControllerError } from "../../utils/controllerError.js";

const createMockRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("controllerError utils", () => {
  it("returns normalized error payload with request id", () => {
    const req = { requestId: "req-1" };
    const res = createMockRes();

    sendControllerError(req, res, { statusCode: 500, message: "Server Error" });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      requestId: "req-1",
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Server Error",
      },
    });
  });

  it("logs structured controller error with inferred route and ids", () => {
    const req = {
      requestId: "req-2",
      method: "POST",
      originalUrl: "/api/tests/abc123/submit",
      baseUrl: "/api/tests",
      route: { path: "/:id/submit" },
      params: { id: "abc123" },
      body: { attemptId: "attempt-1" },
      user: { userId: "user-1" },
    };
    const res = createMockRes();
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    handleControllerError(req, res, new Error("boom"));

    expect(logSpy).toHaveBeenCalledTimes(1);
    const record = JSON.parse(logSpy.mock.calls[0][0]);
    expect(record.route).toBe("POST /api/tests/:id/submit");
    expect(record.requestId).toBe("req-2");
    expect(record.userId).toBe("user-1");
    expect(record.ids).toMatchObject({ id: "abc123", attemptId: "attempt-1" });
    expect(record.error.message).toBe("boom");
  });

  it("supports explicit route override and context ids", () => {
    const req = {
      requestId: "req-3",
      method: "GET",
      originalUrl: "/api/custom",
    };
    const res = createMockRes();
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    handleControllerError(req, res, new Error("fail"), {
      route: "custom.routeName",
      context: { testId: "test-99" },
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Temporarily unavailable",
    });

    const record = JSON.parse(logSpy.mock.calls[0][0]);
    expect(record.route).toBe("custom.routeName");
    expect(record.statusCode).toBe(503);
    expect(record.ids).toMatchObject({ testId: "test-99" });

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      requestId: "req-3",
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Temporarily unavailable",
      },
    });
  });
});
