import dotenv from "dotenv";
import http from "http";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { validateEnvironment } from "./config/env.validation.js";
import { closeRateLimitRedisConnection } from "./middleware/rateLimit.middleware.js";
import { attachWritingLiveWebSocketServer, closeWritingLiveResources } from "./services/writingLiveRoom.service.js";

dotenv.config();
validateEnvironment();
const PORT = Number(process.env.PORT || 5000);

const startServer = async () => {
  const { createApp } = await import("./app.js");
  const app = createApp({ startBackgroundJobs: true });
  await connectDB();
  const httpServer = http.createServer(app);
  attachWritingLiveWebSocketServer(httpServer);

  const server = httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[shutdown] ${signal} received — closing server...`);
    server.close(async () => {
      try {
        await closeRateLimitRedisConnection();
      } catch (err) {
        console.error("[shutdown] Error closing rate-limit Redis connection:", err.message);
      }

      try {
        await closeWritingLiveResources();
      } catch (err) {
        console.error("[shutdown] Error closing writing-live resources:", err.message);
      }

      try {
        await mongoose.connection.close();
        console.log("[shutdown] MongoDB connection closed.");
      } catch (err) {
        console.error("[shutdown] Error closing MongoDB:", err.message);
      }
      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      console.error("[shutdown] Forced exit after timeout.");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((error) => {
  console.error("Server startup failed", error);
  process.exit(1);
});
