const ERROR_CODE_BY_STATUS = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMIT_EXCEEDED",
};

const isPlainObject = (value) => Object.prototype.toString.call(value) === "[object Object]";

const isIdLikeKey = (key = "") => {
  const normalized = String(key || "").trim();
  if (!normalized) return false;
  if (normalized === "id" || normalized === "_id") return true;
  if (normalized.endsWith("_id")) return true;
  if (normalized.endsWith("Id") || normalized.endsWith("ID")) return true;
  return false;
};

const pickIdLikeEntries = (source = {}, maxEntries = 12) => {
  if (!isPlainObject(source)) return {};

  const entries = {};
  for (const [key, value] of Object.entries(source)) {
    if (!isIdLikeKey(key)) continue;
    if (value === undefined || value === null || value === "") continue;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      entries[key] = value;
    }

    if (Object.keys(entries).length >= maxEntries) break;
  }

  return entries;
};

const resolveRouteName = (req, explicitRoute) => {
  if (explicitRoute) return explicitRoute;

  const method = req?.method || "UNKNOWN";
  const routePath = req?.route?.path;
  const baseUrl = req?.baseUrl || "";
  if (routePath) {
    return `${method} ${baseUrl}${routePath}`;
  }

  const originalUrl = req?.originalUrl || req?.url || "unknown";
  return `${method} ${originalUrl}`;
};

const inferErrorCode = (statusCode) =>
  ERROR_CODE_BY_STATUS[Number(statusCode)] || "INTERNAL_SERVER_ERROR";

export const logControllerError = (req, error, { route, context, statusCode } = {}) => {
  const request = req || {};
  const ids = {
    ...pickIdLikeEntries(request.params),
    ...pickIdLikeEntries(request.query),
    ...pickIdLikeEntries(request.body),
    ...(isPlainObject(context) ? context : {}),
  };

  const record = {
    ts: new Date().toISOString(),
    level: "error",
    route: resolveRouteName(request, route),
    requestId: request.requestId || null,
    userId: request.user?.userId || null,
    method: request.method,
    endpoint: request.originalUrl,
    statusCode: Number(statusCode || 500),
    ids: Object.keys(ids).length > 0 ? ids : undefined,
    error: {
      name: error?.name || "Error",
      message: error?.message || "Unknown error",
      code: error?.code || null,
    },
  };

  console.error(JSON.stringify(record));
};

export const sendControllerError = (
  req,
  res,
  {
    statusCode = 500,
    code,
    message = "Server Error",
    details,
  } = {},
) => {
  const normalizedCode = code || inferErrorCode(statusCode);
  const payload = {
    success: false,
    requestId: req?.requestId || undefined,
    error: {
      code: normalizedCode,
      message,
    },
  };

  if (details !== undefined) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
};

export const handleControllerError = (
  req,
  res,
  error,
  {
    route,
    context,
    statusCode = 500,
    code,
    message = "Server Error",
    details,
  } = {},
) => {
  logControllerError(req, error, { route, context, statusCode });
  return sendControllerError(req, res, { statusCode, code, message, details });
};
