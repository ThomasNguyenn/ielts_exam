const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX = 100;
const DEFAULT_CODE = "RATE_LIMIT_EXCEEDED";

export const createRateLimiter = ({
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX,
  code = DEFAULT_CODE,
  message = "Too many requests. Please try again later.",
  keyGenerator = (req) => req.ip || req.socket?.remoteAddress || "unknown",
} = {}) => {
  const bucket = new Map();

  return (req, res, next) => {
    // Do not rate-limit CORS preflight requests.
    if (req.method === "OPTIONS") {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();
    const current = bucket.get(key);

    if (!current || current.resetAt <= now) {
      bucket.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - 1)));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    current.count += 1;
    const remaining = Math.max(0, max - current.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) {
      const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSec, 1)));
      return res.status(429).json({
        success: false,
        error: {
          code,
          message,
        },
      });
    }

    if (bucket.size > 10000) {
      for (const [entryKey, entryValue] of bucket.entries()) {
        if (entryValue.resetAt <= now) {
          bucket.delete(entryKey);
        }
      }
    }

    return next();
  };
};
