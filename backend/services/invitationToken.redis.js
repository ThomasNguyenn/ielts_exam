import IORedis from "ioredis";
import { createHash } from "crypto";
import { getRedisUrl } from "../config/queue.config.js";

const INVITATION_TOKEN_PREFIX = "auth:invite:";
const REDIS_FALLBACK_COOLDOWN_MS = 30_000;

let sharedRedis = null;
let sharedRedisInitialized = false;
let redisFallbackUntil = 0;
let redisFailureLogged = false;

const now = () => Date.now();

const markRedisFailure = (error) => {
  redisFallbackUntil = now() + REDIS_FALLBACK_COOLDOWN_MS;
  if (!redisFailureLogged) {
    redisFailureLogged = true;
    console.warn("[invite-token] Redis unavailable, falling back to Mongo lookup:", error?.message || "Unknown error");
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

const normalizeToken = (value) => String(value || "").trim();

const normalizeTokenCandidates = (values = []) =>
  [...new Set((Array.isArray(values) ? values : []).map(normalizeToken).filter(Boolean))];

const toExpiresAtTimeMs = (value) => {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const toTokenKey = (token) => {
  const normalized = normalizeToken(token);
  if (!normalized) return "";
  const hash = createHash("sha256").update(normalized, "utf8").digest("hex");
  return `${INVITATION_TOKEN_PREFIX}${hash}`;
};

const sanitizeTokenPayload = (payload = {}) => {
  const invitationId = String(payload?.invitationId || payload?._id || "").trim();
  const email = String(payload?.email || "").trim().toLowerCase();
  const role = String(payload?.role || "").trim();
  const status = String(payload?.status || "pending").trim() || "pending";
  const expiresAtMs = toExpiresAtTimeMs(payload?.expiresAt);
  const expiresAt = expiresAtMs > 0 ? new Date(expiresAtMs).toISOString() : null;

  if (!invitationId || !email || !role || !expiresAt) return null;
  return {
    invitationId,
    email,
    role,
    status,
    expiresAt,
  };
};

export const cacheInvitationToken = async (invitation = {}) => {
  const redis = getSharedRedisClient();
  if (!redis) return false;

  const token = normalizeToken(invitation?.token);
  const key = toTokenKey(token);
  if (!key) return false;

  const payload = sanitizeTokenPayload(invitation);
  if (!payload) return false;

  const expiresAtMs = toExpiresAtTimeMs(payload.expiresAt);
  if (expiresAtMs <= now()) {
    await redis.del(key).catch(() => {});
    return false;
  }

  const ttlSec = Math.max(1, Math.ceil((expiresAtMs - now()) / 1000));

  try {
    await redis.set(key, JSON.stringify(payload), "EX", ttlSec);
    redisFailureLogged = false;
    return true;
  } catch (error) {
    markRedisFailure(error);
    return false;
  }
};

export const getInvitationTokenRecord = async (tokenCandidates = []) => {
  const redis = getSharedRedisClient();
  if (!redis) return null;

  const candidates = normalizeTokenCandidates(tokenCandidates);
  if (candidates.length === 0) return null;

  const keys = candidates.map(toTokenKey).filter(Boolean);
  if (keys.length === 0) return null;

  try {
    const pipeline = redis.pipeline();
    keys.forEach((key) => pipeline.get(key));
    const results = await pipeline.exec();
    const staleKeys = [];
    const nowMs = now();

    for (let index = 0; index < results.length; index += 1) {
      const [, rawValue] = results[index] || [];
      if (!rawValue) continue;

      let parsedPayload = null;
      try {
        parsedPayload = JSON.parse(rawValue);
      } catch {
        staleKeys.push(keys[index]);
        continue;
      }

      const payload = sanitizeTokenPayload(parsedPayload);
      if (!payload) {
        staleKeys.push(keys[index]);
        continue;
      }

      if (toExpiresAtTimeMs(payload.expiresAt) <= nowMs || payload.status !== "pending") {
        staleKeys.push(keys[index]);
        continue;
      }

      if (staleKeys.length > 0) {
        await redis.del(...staleKeys).catch(() => {});
      }
      redisFailureLogged = false;
      return {
        token: candidates[index],
        ...payload,
      };
    }

    if (staleKeys.length > 0) {
      await redis.del(...staleKeys).catch(() => {});
    }
    redisFailureLogged = false;
    return null;
  } catch (error) {
    markRedisFailure(error);
    return null;
  }
};

export const deleteInvitationToken = async (token) => {
  const redis = getSharedRedisClient();
  if (!redis) return false;

  const key = toTokenKey(token);
  if (!key) return false;

  try {
    await redis.del(key);
    redisFailureLogged = false;
    return true;
  } catch (error) {
    markRedisFailure(error);
    return false;
  }
};

export const closeInvitationTokenRedisConnection = async () => {
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
