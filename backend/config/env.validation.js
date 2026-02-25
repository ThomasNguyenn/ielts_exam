const REQUIRED_ENV_VARS = [
  "MONGO_URI",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const OPENAI_KEY_ENV_NAMES = ["OPENAI_API_KEY", "OPEN_API_KEY"];
const MIN_SECRET_LENGTH = 32;
const ALLOWED_SAMESITE_VALUES = new Set(["lax", "strict", "none"]);

const toBoolean = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const parseBooleanEnv = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parseOriginList = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => String(origin || "").trim())
    .filter(Boolean);

const isValidOrigin = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isHttpsOrigin = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const hasMinimumLength = (value, minLength) => String(value || "").trim().length >= minLength;

const redact = (value) => {
  if (!value) return "<empty>";
  if (value.length <= 6) return "***";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
};

export const validateEnvironment = ({ env = process.env } = {}) => {
  const requiredVars = [...REQUIRED_ENV_VARS];
  const isProduction = String(env.NODE_ENV || "").trim().toLowerCase() === "production";

  if (isProduction) {
    requiredVars.push("FRONTEND_ORIGINS");
    requiredVars.push("JWT_REFRESH_SECRET");
  }

  if (toBoolean(env.AI_ASYNC_MODE)) {
    requiredVars.push("REDIS_URL");
  }

  const missing = requiredVars.filter((name) => {
    const value = env[name];
    return !value || !String(value).trim();
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  if (isProduction) {
    if (!hasMinimumLength(env.JWT_SECRET, MIN_SECRET_LENGTH)) {
      throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`);
    }
    if (!hasMinimumLength(env.JWT_REFRESH_SECRET, MIN_SECRET_LENGTH)) {
      throw new Error(`JWT_REFRESH_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`);
    }
    if (String(env.JWT_REFRESH_SECRET || "").trim() === String(env.JWT_SECRET || "").trim()) {
      throw new Error("JWT_REFRESH_SECRET must be different from JWT_SECRET in production.");
    }
  }

  if (isProduction) {
    const configuredOrigins = parseOriginList(env.FRONTEND_ORIGINS);
    const invalidOrigins = configuredOrigins.filter((origin) => !isValidOrigin(origin));
    if (configuredOrigins.length === 0 || invalidOrigins.length > 0) {
      const details = invalidOrigins.length > 0 ? ` Invalid origins: ${invalidOrigins.join(", ")}` : "";
      throw new Error(`FRONTEND_ORIGINS must include valid http(s) origins in production.${details}`);
    }

    const nonHttpsOrigins = configuredOrigins.filter((origin) => !isHttpsOrigin(origin));
    if (nonHttpsOrigins.length > 0) {
      throw new Error(`FRONTEND_ORIGINS must use https in production. Insecure origins: ${nonHttpsOrigins.join(", ")}`);
    }

    const sameSite = String(env.REFRESH_COOKIE_SAMESITE || "lax").trim().toLowerCase();
    if (!ALLOWED_SAMESITE_VALUES.has(sameSite)) {
      throw new Error("REFRESH_COOKIE_SAMESITE must be one of: lax, strict, none");
    }

    const refreshCookieSecure = parseBooleanEnv(
      env.REFRESH_COOKIE_SECURE,
      sameSite === "none" || isProduction,
    );
    if (!refreshCookieSecure) {
      throw new Error("REFRESH_COOKIE_SECURE must be true in production.");
    }
    if (sameSite === "none" && !refreshCookieSecure) {
      throw new Error("REFRESH_COOKIE_SECURE must be true when REFRESH_COOKIE_SAMESITE is 'none'.");
    }

    if (toBoolean(env.CORS_ALLOW_NO_ORIGIN)) {
      throw new Error("CORS_ALLOW_NO_ORIGIN must be disabled in production.");
    }
  }

  const hasOpenAiKey = OPENAI_KEY_ENV_NAMES.some((name) => {
    const value = env[name];
    return Boolean(value && String(value).trim());
  });
  const hasGeminiKey = Boolean(env.GEMINI_API_KEY && String(env.GEMINI_API_KEY).trim());

  if (env.NODE_ENV !== "production") {
    const snapshot = requiredVars.reduce((acc, key) => {
      acc[key] = redact(String(env[key] || ""));
      return acc;
    }, {});
    const resolvedOpenAiKey =
      env.OPENAI_API_KEY || env.OPEN_API_KEY || "";
    snapshot.OPENAI_API_KEY = redact(String(resolvedOpenAiKey));
    snapshot.GEMINI_API_KEY = redact(String(env.GEMINI_API_KEY || ""));
    console.log(`[env] validated keys: ${JSON.stringify(snapshot)}`);
  }

  if (!hasOpenAiKey) {
    console.warn("[env] OPENAI_API_KEY is missing. OpenAI features will run in fallback mode.");
  }

  if (!hasGeminiKey) {
    console.warn("[env] GEMINI_API_KEY is missing. Speaking AI features will run in fallback mode.");
  }
};

export const validateWorkerEnvironment = ({ env = process.env } = {}) => {
  const requiredVars = ["MONGO_URI"];
  if (toBoolean(env.AI_ASYNC_MODE)) {
    requiredVars.push("REDIS_URL");
  }

  const missing = requiredVars.filter((name) => {
    const value = env[name];
    return !value || !String(value).trim();
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  if (env.NODE_ENV !== "production") {
    const snapshot = requiredVars.reduce((acc, key) => {
      acc[key] = redact(String(env[key] || ""));
      return acc;
    }, {});
    const resolvedOpenAiKey =
      env.OPENAI_API_KEY || env.OPEN_API_KEY || "";
    snapshot.OPENAI_API_KEY = redact(String(resolvedOpenAiKey));
    snapshot.GEMINI_API_KEY = redact(String(env.GEMINI_API_KEY || ""));
    console.log(`[env:worker] validated keys: ${JSON.stringify(snapshot)}`);
  }

  const hasOpenAiKey = OPENAI_KEY_ENV_NAMES.some((name) => {
    const value = env[name];
    return Boolean(value && String(value).trim());
  });
  const hasGeminiKey = Boolean(env.GEMINI_API_KEY && String(env.GEMINI_API_KEY).trim());

  if (!hasOpenAiKey) {
    console.warn("[env:worker] OPENAI_API_KEY is missing. Writing AI jobs will run in fallback mode.");
  }
  if (!hasGeminiKey) {
    console.warn("[env:worker] GEMINI_API_KEY is missing. Speaking AI jobs will run in fallback mode.");
  }

  const hasCloudinaryConfig = Boolean(
    env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET,
  );
  if (!hasCloudinaryConfig) {
    console.warn("[env:worker] Cloudinary keys are missing. Speaking audio cleanup after scoring is disabled.");
  }
};

export { REQUIRED_ENV_VARS };
