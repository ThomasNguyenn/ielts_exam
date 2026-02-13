import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import { validateEnvironment } from "./config/env.validation.js";

dotenv.config();
validateEnvironment();
const PORT = Number(process.env.PORT || 5000);

const startServer = async () => {
  const { createApp } = await import("./app.js");
  const app = createApp({ startBackgroundJobs: true });
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Server startup failed", error);
  process.exit(1);
});
