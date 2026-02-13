const inferErrorCode = (statusCode) => {
  if (statusCode === 400) return "BAD_REQUEST";
  if (statusCode === 401) return "UNAUTHORIZED";
  if (statusCode === 403) return "FORBIDDEN";
  if (statusCode === 404) return "NOT_FOUND";
  if (statusCode === 409) return "CONFLICT";
  if (statusCode === 413) return "PAYLOAD_TOO_LARGE";
  if (statusCode === 415) return "UNSUPPORTED_MEDIA_TYPE";
  if (statusCode === 422) return "VALIDATION_ERROR";
  if (statusCode === 429) return "RATE_LIMIT_EXCEEDED";
  return "INTERNAL_SERVER_ERROR";
};

export const normalizeErrorResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (res.statusCode < 400) {
      return originalJson(payload);
    }

    if (
      payload &&
      payload.success === false &&
      payload.error &&
      typeof payload.error.message === "string"
    ) {
      return originalJson(payload);
    }

    const message =
      payload?.error?.message ||
      payload?.message ||
      (typeof payload === "string" ? payload : "Request failed");
    const code = payload?.error?.code || payload?.code || inferErrorCode(res.statusCode);
    const details = payload?.error?.details ?? payload?.details;

    const normalized = {
      success: false,
      requestId: req.requestId || undefined,
      error: {
        code,
        message,
      },
    };

    if (details !== undefined) {
      normalized.error.details = details;
    }

    return originalJson(normalized);
  };

  next();
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    requestId: req.requestId || undefined,
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const errorRecord = {
    ts: new Date().toISOString(),
    level: "error",
    requestId: req.requestId || null,
    userId: req.user?.userId || null,
    method: req.method,
    endpoint: req.originalUrl,
    error: {
      name: err?.name || "Error",
      message: err?.message || "Internal Server Error",
      code: err?.code || null,
      status: Number(err?.statusCode || err?.status || 500),
    },
  };
  console.error(JSON.stringify(errorRecord));

  if (err?.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file exceeds the size limit"
        : err.message || "Invalid file upload";

    return res.status(400).json({
      success: false,
      requestId: req.requestId || undefined,
      error: {
        code: "UPLOAD_ERROR",
        message,
      },
    });
  }

  if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      requestId: req.requestId || undefined,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
      },
    });
  }

  const statusCode = Number(err?.statusCode || err?.status || 500);
  const message = err?.message || "Internal Server Error";
  const code = err?.code || inferErrorCode(statusCode);

  return res.status(statusCode).json({
    success: false,
    requestId: req.requestId || undefined,
    error: {
      code,
      message,
    },
  });
};
