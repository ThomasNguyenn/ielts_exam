import IORedis from "ioredis";

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const isAiAsyncModeEnabled = ({ env = process.env } = {}) =>
  toBoolean(env.AI_ASYNC_MODE, false);

export const getRedisUrl = ({ env = process.env } = {}) => {
  const value = env.REDIS_URL;
  if (!value || !String(value).trim()) return null;
  return String(value).trim();
};

export const getAiWorkerConcurrency = ({ env = process.env } = {}) => {
  const raw = Number(env.AI_WORKER_CONCURRENCY || 2);
  if (!Number.isFinite(raw) || raw < 1) return 2;
  return Math.floor(raw);
};

export const createRedisConnection = ({ env = process.env } = {}) => {
  const redisUrl = getRedisUrl({ env });
  if (!redisUrl) return null;

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
};

