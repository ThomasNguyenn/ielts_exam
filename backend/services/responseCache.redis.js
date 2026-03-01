import IORedis from "ioredis";
import { getRedisUrl } from "../config/queue.config.js";

const CACHE_REDIS_FALLBACK_COOLDOWN_MS = 30_000;
const DEFAULT_TAG_TTL_SEC = 1_800;
const TAG_KEY_PREFIX = "resp-cache:tag:";

let sharedRedis = null;
let sharedRedisInitialized = false;
let redisFallbackUntil = 0;
let redisFailureLogged = false;

const now = () => Date.now();

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
};

const normalizeStringArray = (values = []) => {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
};

const markRedisFailure = (error, context = "response-cache") => {
  redisFallbackUntil = now() + CACHE_REDIS_FALLBACK_COOLDOWN_MS;
  if (!redisFailureLogged) {
    redisFailureLogged = true;
    console.warn(`[${context}] Redis unavailable, bypassing cache:`, error?.message || "Unknown error");
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

  client.on("error", (error) => {
    markRedisFailure(error);
  });

  return client;
};

const getSharedRedisClient = () => {
  if (now() < redisFallbackUntil) return null;

  if (!sharedRedisInitialized) {
    sharedRedisInitialized = true;
    sharedRedis = createRedisClient();
  }

  return sharedRedis;
};

const toTagKey = (tag) => `${TAG_KEY_PREFIX}${tag}`;

const getTagTtlSec = (ttlSec) => {
  const baseTtl = toPositiveInt(ttlSec, DEFAULT_TAG_TTL_SEC);
  return Math.max(baseTtl * 3, DEFAULT_TAG_TTL_SEC);
};

export const getJson = async (key) => {
  const redis = getSharedRedisClient();
  if (!redis) return null;

  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return null;

  try {
    const raw = await redis.get(normalizedKey);
    if (!raw) return null;
    redisFailureLogged = false;
    return JSON.parse(raw);
  } catch (error) {
    markRedisFailure(error);
    return null;
  }
};

export const setJson = async (key, value, ttlSec) => {
  const redis = getSharedRedisClient();
  if (!redis) return false;

  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return false;

  const safeTtlSec = toPositiveInt(ttlSec, 120);

  try {
    const serialized = JSON.stringify(value);
    await redis.set(normalizedKey, serialized, "EX", safeTtlSec);
    redisFailureLogged = false;
    return true;
  } catch (error) {
    markRedisFailure(error);
    return false;
  }
};

export const addKeyToTags = async (key, tags = [], ttlSec) => {
  const redis = getSharedRedisClient();
  if (!redis) return false;

  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return false;

  const normalizedTags = normalizeStringArray(tags);
  if (normalizedTags.length === 0) return true;

  const tagTtlSec = getTagTtlSec(ttlSec);
  const pipeline = redis.pipeline();

  normalizedTags.forEach((tag) => {
    const tagKey = toTagKey(tag);
    pipeline.sadd(tagKey, normalizedKey);
    pipeline.expire(tagKey, tagTtlSec);
  });

  try {
    await pipeline.exec();
    redisFailureLogged = false;
    return true;
  } catch (error) {
    markRedisFailure(error);
    return false;
  }
};

export const invalidateTags = async (tags = []) => {
  const redis = getSharedRedisClient();
  if (!redis) return false;

  const normalizedTags = normalizeStringArray(tags);
  if (normalizedTags.length === 0) return true;

  try {
    const tagKeys = normalizedTags.map(toTagKey);
    const fetchPipeline = redis.pipeline();
    tagKeys.forEach((tagKey) => fetchPipeline.smembers(tagKey));
    const fetchResults = await fetchPipeline.exec();

    const keysToDelete = new Set();
    fetchResults.forEach((entry) => {
      const [error, members] = entry || [];
      if (error || !Array.isArray(members)) return;
      members.forEach((member) => {
        const key = String(member || "").trim();
        if (key) keysToDelete.add(key);
      });
    });

    const deletePipeline = redis.pipeline();
    if (keysToDelete.size > 0) {
      deletePipeline.del(...keysToDelete);
    }
    if (tagKeys.length > 0) {
      deletePipeline.del(...tagKeys);
    }

    await deletePipeline.exec();
    redisFailureLogged = false;
    return true;
  } catch (error) {
    markRedisFailure(error);
    return false;
  }
};

export const closeResponseCacheRedisConnection = async () => {
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
