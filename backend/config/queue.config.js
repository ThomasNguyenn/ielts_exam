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

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
};

export const getRedisUrl = ({ env = process.env } = {}) => {
  const value = env.REDIS_URL;
  if (!value || !String(value).trim()) return null;
  return String(value).trim();
};

export const getAiWorkerConcurrency = ({ env = process.env } = {}) => {
  return toPositiveInt(env.AI_WORKER_CONCURRENCY || 2, 2);
};

export const getWritingWorkerConcurrency = ({ env = process.env } = {}) => {
  const fallback = getAiWorkerConcurrency({ env });
  return toPositiveInt(env.AI_WORKER_CONCURRENCY_WRITING, fallback);
};

export const getSpeakingWorkerConcurrency = ({ env = process.env } = {}) => {
  const fallback = getAiWorkerConcurrency({ env });
  return toPositiveInt(env.AI_WORKER_CONCURRENCY_SPEAKING, fallback);
};

export const getTaxonomyWorkerConcurrency = ({ env = process.env } = {}) => {
  const fallback = 1;
  return toPositiveInt(env.AI_WORKER_CONCURRENCY_TAXONOMY, fallback);
};

export const getAiQueueJobAttempts = ({ env = process.env } = {}) =>
  toPositiveInt(env.AI_QUEUE_JOB_ATTEMPTS || 2, 2);

export const getAiQueueJobBackoffMs = ({ env = process.env } = {}) =>
  toPositiveInt(env.AI_QUEUE_JOB_BACKOFF_MS || 1500, 1500);

export const getAiQueueRemoveOnComplete = ({ env = process.env } = {}) =>
  toPositiveInt(env.AI_QUEUE_REMOVE_ON_COMPLETE || 200, 200);

export const getAiQueueRemoveOnFail = ({ env = process.env } = {}) =>
  toPositiveInt(env.AI_QUEUE_REMOVE_ON_FAIL || 500, 500);

export const getWritingTaxonomyTimeoutMs = ({ env = process.env } = {}) =>
  toPositiveInt(env.WRITING_TAXONOMY_TIMEOUT_MS || 18000, 18000);

export const getWritingTaxonomyMaxAttempts = ({ env = process.env } = {}) =>
  toPositiveInt(env.WRITING_TAXONOMY_MAX_ATTEMPTS || 1, 1);

export const getWritingTaxonomyBaseDelayMs = ({ env = process.env } = {}) =>
  toPositiveInt(env.WRITING_TAXONOMY_BASE_DELAY_MS || 250, 250);

export const getWritingTaxonomyModel = ({ env = process.env } = {}) =>
  String(env.WRITING_TAXONOMY_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";

export const isWritingTaxonomyAiFallbackEnabled = ({ env = process.env } = {}) =>
  toBoolean(env.WRITING_TAXONOMY_AI_FALLBACK, true);

export const getWritingTaxonomyAiBatchSize = ({ env = process.env } = {}) =>
  toPositiveInt(env.WRITING_TAXONOMY_AI_BATCH_SIZE || 12, 12);

export const getWritingTaxonomyAiMaxTokens = ({ env = process.env } = {}) =>
  toPositiveInt(env.WRITING_TAXONOMY_AI_MAX_TOKENS || 500, 500);

export const getWritingTaxonomyAiTemperature = ({ env = process.env } = {}) => {
  const parsed = Number(env.WRITING_TAXONOMY_AI_TEMPERATURE);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed));
};

export const createRedisConnection = ({ env = process.env } = {}) => {
  const redisUrl = getRedisUrl({ env });
  if (!redisUrl) return null;

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
};
