const REQUIRED_ENV_VARS = [
  "MONGO_URI",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const OPENAI_KEY_ENV_NAMES = ["OPENAI_API_KEY", "OPEN_API_KEY"];

const toBoolean = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const redact = (value) => {
  if (!value) return "<empty>";
  if (value.length <= 6) return "***";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
};

export const validateEnvironment = ({ env = process.env } = {}) => {
  const requiredVars = [...REQUIRED_ENV_VARS];
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

export { REQUIRED_ENV_VARS };
