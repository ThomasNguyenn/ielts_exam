import IORedis from "ioredis";
import { getRedisUrl } from "../config/queue.config.js";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX = 100;
const DEFAULT_CODE = "RATE_LIMIT_EXCEEDED";
const DEFAULT_PREFIX = "rate-limit";
const REDIS_FALLBACK_COOLDOWN_MS = 30_000;

const REDIS_INCREMENT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`;

let sharedRedis = null;
let sharedRedisInitialized = false;
let redisFallbackUntil = 0;
let redisFailureLogged = false;

export const closeRateLimitRedisConnection = async () => {
  if (!sharedRedis) return;
  try {
    await sharedRedis.quit();
  } catch {
    sharedRedis.disconnect();
  } finally {
    sharedRedis = null;
    sharedRedisInitialized = false;
    redisFallbackUntil = 0;
    redisFailureLogged = false;
  }
};

const createRedisClient = () => {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;

  const client = new IORedis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: false,
    connectTimeout: 1500,
  });

  client.on("error", () => {
    redisFallbackUntil = Date.now() + REDIS_FALLBACK_COOLDOWN_MS;
  });

  return client;
};

const getSharedRedisClient = (allowRedis) => {
  if (!allowRedis) return null;

  if (Date.now() < redisFallbackUntil) {
    return null;
  }

  if (!sharedRedisInitialized) {
    sharedRedisInitialized = true;
    sharedRedis = createRedisClient();
  }

  return sharedRedis;
};

const buildWindowKey = ({ prefix, code, clientKey }) =>
  `${prefix}:${code}:${clientKey}`;

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const runRedisCounter = async ({ redis, key, windowMs }) => {
  const result = await redis.eval(REDIS_INCREMENT_SCRIPT, 1, key, String(windowMs));
  const count = parseNumber(Array.isArray(result) ? result[0] : 0, 0);
  const ttlMs = parseNumber(Array.isArray(result) ? result[1] : -1, -1);
  return { count, ttlMs };
};

const setRateLimitHeaders = ({ res, max, remaining, resetAtMs }) => {
  res.setHeader("X-RateLimit-Limit", String(max));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAtMs / 1000)));
};

export const createRateLimiter = ({
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX,
  code = DEFAULT_CODE,
  prefix = DEFAULT_PREFIX,
  useRedis = true,
  message = "Too many requests. Please try again later.",
  keyGenerator = (req) => req.ip || req.socket?.remoteAddress || "unknown",
} = {}) => {
  const bucket = new Map();
  const allowRedis = useRedis && Boolean(getRedisUrl());

  return async (req, res, next) => {
    // Do not rate-limit CORS preflight requests.
    if (req.method === "OPTIONS") {
      return next();
    }

    const key = String(keyGenerator(req) || "unknown");
    const now = Date.now();
    const redis = getSharedRedisClient(allowRedis);

    let count;
    let resetAt;

    if (redis) {
      try {
        const redisKey = buildWindowKey({ prefix, code, clientKey: key });
        const { count: redisCount, ttlMs } = await runRedisCounter({
          redis,
          key: redisKey,
          windowMs,
        });

        count = redisCount;
        const safeTtlMs = ttlMs > 0 ? ttlMs : windowMs;
        resetAt = now + safeTtlMs;
        redisFailureLogged = false;
      } catch (error) {
        redisFallbackUntil = now + REDIS_FALLBACK_COOLDOWN_MS;
        if (!redisFailureLogged) {
          redisFailureLogged = true;
          console.warn("[rate-limit] Redis unavailable, falling back to in-memory store:", error.message);
        }
      }
    }

    if (!Number.isFinite(count)) {
      const current = bucket.get(key);

      if (!current || current.resetAt <= now) {
        count = 1;
        resetAt = now + windowMs;
        bucket.set(key, { count, resetAt });
      } else {
        count = current.count + 1;
        resetAt = current.resetAt;
        current.count = count;
      }

      if (bucket.size > 10000) {
        for (const [entryKey, entryValue] of bucket.entries()) {
          if (entryValue.resetAt <= now) {
            bucket.delete(entryKey);
          }
        }
      }
    }

    const remaining = Math.max(0, max - count);
    setRateLimitHeaders({
      res,
      max,
      remaining,
      resetAtMs: resetAt,
    });

    if (count > max) {
      const retryAfterSec = Math.ceil((resetAt - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSec, 1)));
      return res.status(429).json({
        success: false,
        error: {
          code,
          message,
        },
      });
    }

    return next();
  };
};
