import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnvironment } from "../../config/env.validation.js";

const baseEnv = {
  MONGO_URI: "mongodb://127.0.0.1:27017/test",
  JWT_SECRET: "test-jwt-secret-with-minimum-length-32-chars",
  JWT_REFRESH_SECRET: "test-refresh-secret-with-minimum-length-32",
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

  it("rejects non-https FRONTEND_ORIGINS in production", () => {
    expect(() =>
      validateEnvironment({
        env: {
          ...baseEnv,
          NODE_ENV: "production",
          FRONTEND_ORIGINS: "http://app.example.com",
        },
      }),
    ).toThrow("must use https");
  });

  it("rejects weak JWT secrets in production", () => {
    expect(() =>
      validateEnvironment({
        env: {
          ...baseEnv,
          NODE_ENV: "production",
          JWT_SECRET: "short-secret",
          FRONTEND_ORIGINS: "https://app.example.com",
        },
      }),
    ).toThrow("JWT_SECRET must be at least");
  });

  it("requires a distinct JWT_REFRESH_SECRET in production", () => {
    expect(() =>
      validateEnvironment({
        env: {
          ...baseEnv,
          NODE_ENV: "production",
          JWT_REFRESH_SECRET: baseEnv.JWT_SECRET,
          FRONTEND_ORIGINS: "https://app.example.com",
        },
      }),
    ).toThrow("must be different");
  });
});
