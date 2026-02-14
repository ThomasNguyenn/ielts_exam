import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createRateLimiter } from "./middleware/rateLimit.middleware.js";
import { validateWriteRequestBody } from "./middleware/requestValidation.middleware.js";
import { normalizeErrorResponse, notFoundHandler, errorHandler } from "./middleware/error.middleware.js";
import { attachRequestContext, requestLogger } from "./middleware/logging.middleware.js";
import { getDBHealth } from "./config/db.js";

import passageRoutes from "./routes/passage.route.js";
import sectionRoutes from "./routes/section.route.js";
import testRoutes from "./routes/test.route.js";
import writingRoutes from "./routes/writing.route.js";
import practiceRoutes from "./routes/practiceRoutes.js";
import authRoutes from "./routes/auth.route.js";
import vocabularyRoutes from "./routes/vocabularyRoutes.js";
import adminRoutes from "./routes/admin.route.js";
import speakingRoutes from "./routes/speaking.routes.js";
import contentGenRoutes from "./routes/contentGen.route.js";
import studyPlanRoutes from "./routes/studyPlan.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import skillsRoutes from "./routes/skills.routes.js";
import progressRoutes from "./routes/progress.routes.js";
import modelEssayRoutes from "./routes/modelEssay.routes.js";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const applyIf = (predicate, middleware) => (req, res, next) => {
  if (predicate(req)) {
    return middleware(req, res, next);
  }
  return next();
};

const ensureUploadDirectory = () => {
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

const createRecordingCleanupJob = (uploadDir) => {
  const recordingsDir = path.join(uploadDir, "recordings");

  return async () => {
    try {
      if (!fs.existsSync(recordingsDir)) return;
      const entries = await fs.promises.readdir(recordingsDir, { withFileTypes: true });
      const now = Date.now();

      await Promise.all(entries.map(async (entry) => {
        if (!entry.isFile()) return;
        const fullPath = path.join(recordingsDir, entry.name);

        try {
          const stats = await fs.promises.stat(fullPath);
          if (now - stats.mtimeMs > TWO_DAYS_MS) {
            await fs.promises.unlink(fullPath);
            console.log(`[cleanup] Deleted old recording: ${fullPath}`);
          }
        } catch (error) {
          console.warn(`[cleanup] Failed to process ${fullPath}:`, error.message);
        }
      }));
    } catch (error) {
      console.warn("[cleanup] Failed to scan recordings:", error.message);
    }
  };
};

export const createApp = ({ startBackgroundJobs = true } = {}) => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  const configuredOrigins = (process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ];

  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const corsError = new Error("CORS origin is not allowed");
      corsError.statusCode = 403;
      corsError.code = "CORS_ORIGIN_DENIED";
      return callback(corsError);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 600,
  };

  const jsonBodyLimit = process.env.REQUEST_BODY_LIMIT || "1mb";

  const authRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    code: "AUTH_RATE_LIMIT_EXCEEDED",
    message: "Too many auth requests. Please try again later.",
  });

  const aiRateLimit = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 30,
    code: "AI_RATE_LIMIT_EXCEEDED",
    message: "Too many AI requests. Please try again later.",
  });

  const submitRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 60,
    code: "SUBMIT_RATE_LIMIT_EXCEEDED",
    message: "Too many submissions. Please try again later.",
  });

  const uploadRateLimit = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    code: "UPLOAD_RATE_LIMIT_EXCEEDED",
    message: "Too many upload requests. Please try again later.",
  });

  app.use(normalizeErrorResponse);
  app.use(attachRequestContext);
  app.use(requestLogger);
  app.use(cors(corsOptions));
  app.use(express.json({ limit: jsonBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));
  app.use(validateWriteRequestBody);

  app.get("/api/health", async (req, res) => {
    const db = await getDBHealth({ includePing: false });
    const status = db.connected ? "ok" : "degraded";
    const statusCode = db.connected ? 200 : 503;

    return res.status(statusCode).json({
      success: statusCode === 200,
      status,
      requestId: req.requestId,
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      db,
    });
  });

  app.get("/api/health/db", async (req, res) => {
    const db = await getDBHealth({ includePing: true });
    const status = db.connected ? "ok" : "down";
    const statusCode = db.connected ? 200 : 503;

    return res.status(statusCode).json({
      success: statusCode === 200,
      status,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      db,
    });
  });

  app.use("/api/auth", authRateLimit);
  app.use("/api/content-gen", aiRateLimit);
  app.use("/api/practice", applyIf((req) => req.path === "/outline-check" || req.path === "/submit" || req.path.startsWith("/materials/"), aiRateLimit));
  app.use("/api/writings", applyIf((req) => req.method === "POST" && /\/submissions\/[^/]+\/ai-score$/.test(req.path), aiRateLimit));
  app.use(
    "/api/writings",
    applyIf(
      (req) =>
        req.method === "POST" &&
        /\/[^/]+\/submit$/.test(req.path) &&
        String(req.body?.gradingMode || "").toLowerCase() === "ai",
      aiRateLimit,
    ),
  );
  app.use("/api/speaking/submit", applyIf((req) => req.method === "POST", aiRateLimit));

  app.use("/api/tests", applyIf((req) => req.method === "POST" && /\/[^/]+\/submit$/.test(req.path), submitRateLimit));
  app.use("/api/writings", applyIf((req) => req.method === "POST" && /\/[^/]+\/submit$/.test(req.path), submitRateLimit));
  app.use("/api/practice/submit", applyIf((req) => req.method === "POST", submitRateLimit));
  app.use("/api/speaking/submit", applyIf((req) => req.method === "POST", submitRateLimit));

  app.use("/api/writings/upload-image", applyIf((req) => req.method === "POST", uploadRateLimit));
  app.use("/api/speaking/submit", applyIf((req) => req.method === "POST", uploadRateLimit));

  app.use("/api/auth", authRoutes);
  app.use("/api/passages", passageRoutes);
  app.use("/api/sections", sectionRoutes);
  app.use("/api/tests", testRoutes);
  app.use("/api/writings", writingRoutes);
  app.use("/api/practice", practiceRoutes);
  app.use("/api/vocabulary", vocabularyRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/speaking", speakingRoutes);
  app.use("/api/content-gen", contentGenRoutes);
  app.use("/api/study-plan", studyPlanRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/skills", skillsRoutes);
  app.use("/api/progress", progressRoutes);
  app.use("/api/model-essays", modelEssayRoutes);

  const uploadDir = ensureUploadDirectory();
  app.use("/uploads", express.static(uploadDir));

  if (startBackgroundJobs) {
    const cleanupOldRecordings = createRecordingCleanupJob(uploadDir);
    cleanupOldRecordings();
    const cleanupInterval = setInterval(cleanupOldRecordings, 12 * 60 * 60 * 1000);
    cleanupInterval.unref?.();
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
