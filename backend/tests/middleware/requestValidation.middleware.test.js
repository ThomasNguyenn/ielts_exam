import { describe, expect, it, vi } from "vitest";
import { validateWriteRequestBody } from "../../middleware/requestValidation.middleware.js";

const buildObjectWithKeyCount = (count) =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [`k${index}`, index]));

const createMockResponse = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe("requestValidation.middleware", () => {
  it("rejects oversized payloads on default routes", () => {
    const req = {
      method: "POST",
      path: "/api/tests",
      headers: { "content-type": "application/json" },
      body: buildObjectWithKeyCount(1001),
    };
    const res = createMockResponse();
    const next = vi.fn();

    validateWriteRequestBody(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_PAYLOAD",
          message: "Payload has too many keys",
        }),
      }),
    );
  });

  it("allows larger payloads on homework assignment write routes", () => {
    const req = {
      method: "PATCH",
      path: "/api/homework/assignments/abc123/lessons/lesson123",
      headers: { "content-type": "application/json" },
      body: buildObjectWithKeyCount(3000),
    };
    const res = createMockResponse();
    const next = vi.fn();

    validateWriteRequestBody(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
