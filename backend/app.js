import express from "express";
import cors from "cors";
import helmet from "helmet";
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
import leaderboardRoutes from "./routes/leaderboard.route.js";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const TRUST_PROXY_HINTS = new Set(["loopback", "linklocal", "uniquelocal"]);
const LOCAL_FALLBACK_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const applyIf = (predicate, middleware) => (req, res, next) => {
  if (predicate(req)) {
    return middleware(req, res, next);
  }
  return next();
};

const resolveTrustProxySetting = () => {
  const raw = String(process.env.TRUST_PROXY || "").trim();
  if (!raw) return false;

  const normalized = raw.toLowerCase();
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["1", "true", "yes", "on"].includes(normalized)) return 1;
  if (TRUST_PROXY_HINTS.has(normalized)) return normalized;

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber >= 0) return Math.floor(asNumber);
  return raw;
};

const parseBooleanEnv = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const normalizeOrigin = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
};

const resolveAllowedOrigins = () => {
  const configuredOrigins = String(process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  const fallbackOrigins = LOCAL_FALLBACK_ORIGINS
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  return configuredOrigins.length > 0 ? configuredOrigins : fallbackOrigins;
};

const shouldAllowNoOriginCorsRequests = () =>
  parseBooleanEnv(process.env.CORS_ALLOW_NO_ORIGIN, process.env.NODE_ENV !== "production");

const hasCloudinaryConfig = () =>
  Boolean(
    String(process.env.CLOUDINARY_CLOUD_NAME || "").trim() &&
    String(process.env.CLOUDINARY_API_KEY || "").trim() &&
    String(process.env.CLOUDINARY_API_SECRET || "").trim(),
  );

const shouldServeLocalUploads = () =>
  parseBooleanEnv(process.env.SERVE_LOCAL_UPLOADS, !hasCloudinaryConfig());

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
  app.use(helmet());
  app.set("trust proxy", resolveTrustProxySetting());

  const allowedOrigins = resolveAllowedOrigins();
  const allowNoOriginCorsRequests = shouldAllowNoOriginCorsRequests();

  const buildCorsError = (message, code) => {
    const error = new Error(message);
    error.statusCode = 403;
    error.code = code;
    return error;
  };

  const shouldAllowNoOriginForRequest = (req) => {
    if (allowNoOriginCorsRequests) return true;

    const secFetchSite = String(req.get("Sec-Fetch-Site") || "")
      .trim()
      .toLowerCase();
    if (secFetchSite === "same-origin" || secFetchSite === "same-site") {
      return true;
    }

    const hasAuthorization = Boolean(String(req.get("Authorization") || "").trim());
    return hasAuthorization;
  };

  const corsBaseOptions = {
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
  app.use((req, res, next) => {
    const options = {
      ...corsBaseOptions,
      origin: (origin, callback) => {
        if (!origin) {
          if (shouldAllowNoOriginForRequest(req)) {
            return callback(null, true);
          }
          return callback(buildCorsError("CORS origin header is required", "CORS_ORIGIN_REQUIRED"));
        }

        const normalizedOrigin = normalizeOrigin(origin);
        if (normalizedOrigin && allowedOrigins.includes(normalizedOrigin)) {
          return callback(null, true);
        }

        return callback(buildCorsError("CORS origin is not allowed", "CORS_ORIGIN_DENIED"));
      },
    };

    return cors(options)(req, res, next);
  });
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

  app.use("/api/auth", applyIf((req) => req.path !== "/profile", authRateLimit));
  app.use("/api/content-gen", aiRateLimit);
  app.use("/api/practice", applyIf((req) => req.path === "/outline-check" || req.path === "/submit" || req.path.startsWith("/materials/"), aiRateLimit));
  app.use("/api/writings", applyIf((req) => req.method === "POST" && /\/submissions\/[^/]+\/ai-(fast-)?score$/.test(req.path), aiRateLimit));
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
  app.use("/api", leaderboardRoutes);

  if (shouldServeLocalUploads()) {
    const uploadDir = ensureUploadDirectory();
    app.use("/uploads", express.static(uploadDir, {
      maxAge: "1d",
      etag: true,
      lastModified: true,
    }));

    if (startBackgroundJobs) {
      const cleanupOldRecordings = createRecordingCleanupJob(uploadDir);
      cleanupOldRecordings();
      const cleanupInterval = setInterval(cleanupOldRecordings, 12 * 60 * 60 * 1000);
      cleanupInterval.unref?.();
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
