const requireEnv = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
};

export const JWT_SECRET = requireEnv("JWT_SECRET");
const IS_PRODUCTION = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const ALLOWED_SAMESITE_VALUES = new Set(["lax", "strict", "none"]);

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

if (!REFRESH_COOKIE_PATH.startsWith("/")) {
  throw new Error("REFRESH_COOKIE_PATH must start with '/'");
}

const defaultSameSite = "lax";
export const REFRESH_COOKIE_SAMESITE = (process.env.REFRESH_COOKIE_SAMESITE || defaultSameSite)
  .trim()
  .toLowerCase();
if (!ALLOWED_SAMESITE_VALUES.has(REFRESH_COOKIE_SAMESITE)) {
  throw new Error("REFRESH_COOKIE_SAMESITE must be one of: lax, strict, none");
}

export const REFRESH_COOKIE_SECURE = parseBooleanEnv(
  process.env.REFRESH_COOKIE_SECURE,
  REFRESH_COOKIE_SAMESITE === "none" || IS_PRODUCTION,
);
if (REFRESH_COOKIE_SAMESITE === "none" && !REFRESH_COOKIE_SECURE) {
  throw new Error("REFRESH_COOKIE_SECURE must be true when REFRESH_COOKIE_SAMESITE is 'none'");
}
