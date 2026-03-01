import Redis from "ioredis";

let redisClient = null;
let isRedisDisabled = false;

const resolveRedisUrl = () => {
  const fromUrl = String(process.env.REDIS_URL || "").trim();
  if (fromUrl) return fromUrl;

  const host = String(process.env.REDIS_HOST || "").trim();
  if (!host) return "";

  const port = Number(process.env.REDIS_PORT || 6379);
  const username = String(process.env.REDIS_USERNAME || "").trim();
  const password = String(process.env.REDIS_PASSWORD || "").trim();

  if (username || password) {
    const userInfo = `${encodeURIComponent(username)}:${encodeURIComponent(password)}`;
    return `redis://${userInfo}@${host}:${port}`;
  }

  return `redis://${host}:${port}`;
};

const createRedisClientInstance = () => {
  const redisUrl = resolveRedisUrl();
  if (!redisUrl) return null;

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required for Pub/Sub and blocking commands
    enableReadyCheck: true,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.warn("[redis] Client error:", err.message);
  });

  return client;
};

const createRedisClient = () => {
  const client = createRedisClientInstance();
  if (!client) {
    isRedisDisabled = true;
    return null;
  }
  // For the main client, we might want maxRetriesPerRequest: 1 to fail fast on regular commands
  // but ioredis default is usually better for general stability.
  return client;
};

export const getRedisClient = () => {
  if (isRedisDisabled) return null;
  if (redisClient) return redisClient;

  redisClient = createRedisClient();
  return redisClient;
};

export { createRedisClientInstance };

export const closeRedisClient = async () => {
  if (!redisClient) return;

  try {
    await redisClient.quit();
  } catch {
    try {
      redisClient.disconnect();
    } catch {
      // Ignore close failures.
    }
  } finally {
    redisClient = null;
  }
};
