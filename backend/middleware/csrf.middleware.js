const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const COOKIE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const normalizeOrigin = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
};

const parseAllowedOrigins = () => {
  const configured = String(process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  const fallback = DEFAULT_ALLOWED_ORIGINS
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  return new Set(configured.length > 0 ? configured : fallback);
};

const getRequestOrigin = (req) => {
  const fromOriginHeader = normalizeOrigin(req.headers?.origin);
  if (fromOriginHeader) return fromOriginHeader;

  const fromReferer = normalizeOrigin(req.headers?.referer);
  if (fromReferer) return fromReferer;

  return null;
};

const hasCookieHeader = (req) => Boolean(String(req.headers?.cookie || "").trim());

export const requireTrustedOrigin = (req, res, next) => {
  const method = String(req.method || "").toUpperCase();
  if (!COOKIE_METHODS.has(method)) {
    return next();
  }

  if (!hasCookieHeader(req)) {
    return next();
  }

  const requestOrigin = getRequestOrigin(req);
  const allowedOrigins = parseAllowedOrigins();
  const hostHeader = req.get("host");
  const hostOrigin = hostHeader ? normalizeOrigin(`${req.protocol}://${hostHeader}`) : null;
  if (hostOrigin) {
    allowedOrigins.add(hostOrigin);
  }

  if (!requestOrigin) {
    return res.status(403).json({
      success: false,
      code: "CSRF_ORIGIN_REQUIRED",
      message: "Origin or Referer header is required",
    });
  }

  if (!allowedOrigins.has(requestOrigin)) {
    return res.status(403).json({
      success: false,
      code: "CSRF_ORIGIN_DENIED",
      message: "Request origin is not allowed",
    });
  }

  return next();
};
