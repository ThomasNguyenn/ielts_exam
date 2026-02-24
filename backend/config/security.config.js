const requireEnv = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
};

export const JWT_SECRET = requireEnv("JWT_SECRET");

const parseBooleanEnv = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const JWT_REFRESH_SECRET = (process.env.JWT_REFRESH_SECRET || "").trim() || JWT_SECRET;
export const ACCESS_TOKEN_EXPIRES_IN = (process.env.ACCESS_TOKEN_EXPIRES_IN || "15m").trim();
export const REFRESH_TOKEN_EXPIRES_IN = (process.env.REFRESH_TOKEN_EXPIRES_IN || "30d").trim();
export const REFRESH_COOKIE_NAME = (process.env.REFRESH_COOKIE_NAME || "lr_refresh").trim();
export const REFRESH_COOKIE_PATH = (process.env.REFRESH_COOKIE_PATH || "/api/auth").trim();

const defaultSameSite = process.env.NODE_ENV === "production" ? "none" : "lax";
export const REFRESH_COOKIE_SAMESITE = (process.env.REFRESH_COOKIE_SAMESITE || defaultSameSite).trim().toLowerCase();
export const REFRESH_COOKIE_SECURE = parseBooleanEnv(
  process.env.REFRESH_COOKIE_SECURE,
  REFRESH_COOKIE_SAMESITE === "none" || process.env.NODE_ENV === "production",
);
