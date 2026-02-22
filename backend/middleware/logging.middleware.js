import { randomUUID } from "crypto";

const nowIso = () => new Date().toISOString();

const roundLatency = (ms) => Math.round(ms * 100) / 100;

export const attachRequestContext = (req, res, next) => {
  const inboundRequestId = req.headers["x-request-id"];
  const requestId =
    typeof inboundRequestId === "string" && inboundRequestId.trim()
      ? inboundRequestId.trim()
      : randomUUID();

  req.requestId = requestId;
  req.startedAtMs = Date.now();
  res.setHeader("X-Request-Id", requestId);
  next();
};

export const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    const record = {
      ts: nowIso(),
      level,
      requestId: req.requestId || null,
      userId: req.user?.userId || null,
      method: req.method,
      endpoint: req.originalUrl,
      statusCode: res.statusCode,
      latencyMs: roundLatency(latencyMs),
      ip: req.ip,
    };

    console.log(JSON.stringify(record));
  });

  next();
};
