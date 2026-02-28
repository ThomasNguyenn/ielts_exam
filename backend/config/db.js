
import mongoose from 'mongoose';


const clientOptions = {
  serverApi: { version: '1', strict: true, deprecationErrors: true },
  maxPoolSize: 50,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
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

