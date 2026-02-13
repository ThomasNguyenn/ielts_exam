import dotenv from "dotenv";
import { Worker } from "bullmq";
import { connectDB } from "../config/db.js";
import { validateEnvironment } from "../config/env.validation.js";
import {
  createRedisConnection,
  getAiWorkerConcurrency,
  isAiAsyncModeEnabled,
} from "../config/queue.config.js";
import { WRITING_AI_QUEUE, SPEAKING_AI_QUEUE } from "../queues/ai.queue.js";

dotenv.config();

const log = (message, extra = {}) => {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    service: "ai-worker",
    message,
    ...extra,
  }));
};

const main = async () => {
  validateEnvironment();

  if (!isAiAsyncModeEnabled()) {
    log("AI async mode disabled. Worker will not start.");
    process.exit(0);
  }

  const redisConnection = createRedisConnection();
  if (!redisConnection) {
    throw new Error("REDIS_URL is required when AI_ASYNC_MODE=true");
  }

  await connectDB();
  const concurrency = getAiWorkerConcurrency();
  const [{ scoreWritingSubmissionById }, { scoreSpeakingSessionById }] = await Promise.all([
    import("../services/writingSubmissionScoring.service.js"),
    import("../services/speakingGrading.service.js"),
  ]);

  const writingWorker = new Worker(
    WRITING_AI_QUEUE,
    async (job) => {
      const { submissionId, force = false } = job.data || {};
      if (!submissionId) throw new Error("Missing submissionId");
      await scoreWritingSubmissionById({ submissionId, force });
      return { submissionId };
    },
    { connection: redisConnection, concurrency },
  );

  const speakingWorker = new Worker(
    SPEAKING_AI_QUEUE,
    async (job) => {
      const { sessionId, force = false } = job.data || {};
      if (!sessionId) throw new Error("Missing sessionId");
      await scoreSpeakingSessionById({ sessionId, force });
      return { sessionId };
    },
    { connection: redisConnection, concurrency },
  );

  writingWorker.on("completed", (job) => {
    log("Writing job completed", { jobId: job.id });
  });
  writingWorker.on("failed", (job, err) => {
    log("Writing job failed", { jobId: job?.id, error: err?.message });
  });
  speakingWorker.on("completed", (job) => {
    log("Speaking job completed", { jobId: job.id });
  });
  speakingWorker.on("failed", (job, err) => {
    log("Speaking job failed", { jobId: job?.id, error: err?.message });
  });

  log("AI workers started", {
    queues: [WRITING_AI_QUEUE, SPEAKING_AI_QUEUE],
    concurrency,
  });
};

main().catch((error) => {
  console.error("AI worker failed to start", error);
  process.exit(1);
});
