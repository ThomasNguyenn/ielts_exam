import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnvironment } from "../../config/env.validation.js";

const baseEnv = {
  MONGO_URI: "mongodb://127.0.0.1:27017/test",
  JWT_SECRET: "test-jwt-secret",
  CLOUDINARY_CLOUD_NAME: "cloud",
  CLOUDINARY_API_KEY: "api-key",
  CLOUDINARY_API_SECRET: "api-secret",
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateEnvironment", () => {
  it("does not require FRONTEND_ORIGINS outside production", () => {
    expect(() =>
      validateEnvironment({
        env: {
          ...baseEnv,
          NODE_ENV: "development",
        },
      }),
    ).not.toThrow();
  });

  it("requires FRONTEND_ORIGINS in production", () => {
    expect(() =>
      validateEnvironment({
        env: {
          ...baseEnv,
          NODE_ENV: "production",
        },
      }),
    ).toThrow("FRONTEND_ORIGINS");
  });

  it("rejects invalid FRONTEND_ORIGINS in production", () => {
    expect(() =>
      validateEnvironment({
        env: {
          ...baseEnv,
          NODE_ENV: "production",
          FRONTEND_ORIGINS: "not-a-valid-origin,https://valid.example.com",
        },
      }),
    ).toThrow("Invalid origins");
  });

  it("accepts valid FRONTEND_ORIGINS in production", () => {
    expect(() =>
      validateEnvironment({
        env: {
          ...baseEnv,
          NODE_ENV: "production",
          FRONTEND_ORIGINS: "https://app.example.com,https://admin.example.com",
        },
      }),
    ).not.toThrow();
  });
});
