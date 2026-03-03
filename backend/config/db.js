
import mongoose from 'mongoose';

const DEFAULT_MAX_POOL_SIZE = 50;
const DEFAULT_MIN_POOL_SIZE = 5;
const DEFAULT_MAX_IDLE_TIME_MS = 30000;

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
};

const resolvedMaxPoolSize = toPositiveInt(process.env.MONGO_MAX_POOL_SIZE, DEFAULT_MAX_POOL_SIZE);
const resolvedMinPoolSize = Math.min(DEFAULT_MIN_POOL_SIZE, resolvedMaxPoolSize);
const resolvedMaxIdleTimeMs = toPositiveInt(process.env.MONGO_MAX_IDLE_TIME_MS, DEFAULT_MAX_IDLE_TIME_MS);

const clientOptions = {
  serverApi: { version: '1', strict: true, deprecationErrors: true },
  maxPoolSize: resolvedMaxPoolSize,
  minPoolSize: resolvedMinPoolSize,
  maxIdleTimeMS: resolvedMaxIdleTimeMs,
};
const STATE_LABELS = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export const connectDB = async function run() {
  try {
    // Create a Mongoose client with a MongoClientOptions object to set the Stable API version
    await mongoose.connect(process.env.MONGO_URI, clientOptions);
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("Database connection failed", error);
    process.exit(1);
  }
}

export const getDBHealth = async ({ includePing = false } = {}) => {
  const readyState = mongoose.connection.readyState;
  const health = {
    readyState,
    state: STATE_LABELS[readyState] || "unknown",
    connected: readyState === 1,
  };

  if (includePing && health.connected) {
    try {
      await mongoose.connection.db.admin().command({ ping: 1 });
      health.ping = "ok";
    } catch (error) {
      health.connected = false;
      health.ping = "failed";
      health.error = error.message;
    }
  }

  return health;
};
