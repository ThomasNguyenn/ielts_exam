import fs from "fs";
import path from "path";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  SERVE_LOCAL_UPLOADS: process.env.SERVE_LOCAL_UPLOADS,
};

const uploadsDir = path.join(process.cwd(), "uploads");
const testFilename = "uploads-policy-test.txt";
const testFilePath = path.join(uploadsDir, testFilename);

const restoreEnvValue = (key, value) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
};

const buildApp = async (overrides = {}) => {
  process.env.NODE_ENV = "production";
  process.env.FRONTEND_ORIGINS = "https://app.example.com";
  process.env.CLOUDINARY_CLOUD_NAME = "cloud";
  process.env.CLOUDINARY_API_KEY = "api-key";
  process.env.CLOUDINARY_API_SECRET = "api-secret";
  delete process.env.SERVE_LOCAL_UPLOADS;

  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }

  const { createApp } = await import("../../app.js");
  return createApp({ startBackgroundJobs: false });
};

beforeAll(() => {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(testFilePath, "upload-policy-check", "utf8");
});

afterAll(() => {
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }

  restoreEnvValue("NODE_ENV", ORIGINAL_ENV.NODE_ENV);
  restoreEnvValue("CLOUDINARY_CLOUD_NAME", ORIGINAL_ENV.CLOUDINARY_CLOUD_NAME);
  restoreEnvValue("CLOUDINARY_API_KEY", ORIGINAL_ENV.CLOUDINARY_API_KEY);
  restoreEnvValue("CLOUDINARY_API_SECRET", ORIGINAL_ENV.CLOUDINARY_API_SECRET);
  restoreEnvValue("SERVE_LOCAL_UPLOADS", ORIGINAL_ENV.SERVE_LOCAL_UPLOADS);
});

beforeEach(() => {
  restoreEnvValue("NODE_ENV", ORIGINAL_ENV.NODE_ENV);
  restoreEnvValue("CLOUDINARY_CLOUD_NAME", ORIGINAL_ENV.CLOUDINARY_CLOUD_NAME);
  restoreEnvValue("CLOUDINARY_API_KEY", ORIGINAL_ENV.CLOUDINARY_API_KEY);
  restoreEnvValue("CLOUDINARY_API_SECRET", ORIGINAL_ENV.CLOUDINARY_API_SECRET);
  restoreEnvValue("SERVE_LOCAL_UPLOADS", ORIGINAL_ENV.SERVE_LOCAL_UPLOADS);
});

describe("local uploads exposure policy", () => {
  it("does not expose /uploads by default when Cloudinary is configured", async () => {
    const app = await buildApp();

    const res = await request(app)
      .get(`/uploads/${testFilename}`)
      .set("Origin", "https://app.example.com");

    expect(res.status).toBe(404);
  });

  it("exposes /uploads when SERVE_LOCAL_UPLOADS=true", async () => {
    const app = await buildApp({ SERVE_LOCAL_UPLOADS: "true" });

    const res = await request(app)
      .get(`/uploads/${testFilename}`)
      .set("Origin", "https://app.example.com");

    expect(res.status).toBe(200);
    expect(res.text).toBe("upload-policy-check");
  });
});
