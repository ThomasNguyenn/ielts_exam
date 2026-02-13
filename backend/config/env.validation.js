const REQUIRED_ENV_VARS = [
  "MONGO_URI",
  "JWT_SECRET",
  "OPEN_API_KEY",
  "GEMINI_API_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

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

  if (env.NODE_ENV !== "production") {
    const snapshot = requiredVars.reduce((acc, key) => {
      acc[key] = redact(String(env[key] || ""));
      return acc;
    }, {});
    console.log(`[env] validated keys: ${JSON.stringify(snapshot)}`);
  }
};

export { REQUIRED_ENV_VARS };
