import dotenv from "dotenv";
import { Worker } from "bullmq";
import { connectDB } from "../config/db.js";
import { validateWorkerEnvironment } from "../config/env.validation.js";
import {
  createRedisConnection,
  getSpeakingWorkerConcurrency,
  getTaxonomyWorkerConcurrency,
  getWritingWorkerConcurrency,
  isAiAsyncModeEnabled,
} from "../config/queue.config.js";
import {
  SPEAKING_PHASE1_JOB,
  SPEAKING_PHASE2_JOB,
  SPEAKING_SCORE_JOB,
  SPEAKING_AI_QUEUE,
  WRITING_AI_QUEUE,
  WRITING_TAXONOMY_QUEUE,
  enqueueSpeakingAiPhase2Job,
} from "../queues/ai.queue.js";

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
  validateWorkerEnvironment();

  if (!isAiAsyncModeEnabled()) {
    log("AI async mode disabled. Worker will not start.");
    process.exit(0);
  }

  const redisConnection = createRedisConnection();
  if (!redisConnection) {
    throw new Error("REDIS_URL is required when AI_ASYNC_MODE=true");
  }

  await connectDB();
  const writingConcurrency = getWritingWorkerConcurrency();
  const speakingConcurrency = getSpeakingWorkerConcurrency();
  const taxonomyConcurrency = getTaxonomyWorkerConcurrency();
  const [{ scoreWritingSubmissionById }, { scoreSpeakingSessionById, scoreSpeakingPhase1ById, scoreSpeakingPhase2ById }, { enrichWritingTaxonomyBySubmissionId }] = await Promise.all([
    import("../services/writingSubmissionScoring.service.js"),
    import("../services/speakingGrading.service.js"),
    import("../services/writingTaxonomyEnrichment.service.js"),
  ]);

  const writingWorker = new Worker(
    WRITING_AI_QUEUE,
    async (job) => {
      const { submissionId, force = false } = job.data || {};
      if (!submissionId) throw new Error("Missing submissionId");
      await scoreWritingSubmissionById({ submissionId, force });
      return { submissionId };
    },
    { connection: redisConnection, concurrency: writingConcurrency },
  );

  const speakingWorker = new Worker(
    SPEAKING_AI_QUEUE,
    async (job) => {
      const { sessionId, force = false } = job.data || {};
      if (!sessionId) throw new Error("Missing sessionId");

      if (job.name === SPEAKING_PHASE1_JOB) {
        const phase1Result = await scoreSpeakingPhase1ById({ sessionId, force });
        const shouldRunPhase2 = String(phase1Result?.session?.status || "").toLowerCase() !== "completed";
        if (shouldRunPhase2) {
          await enqueueSpeakingAiPhase2Job({ sessionId, force });
        }
        return { sessionId, stage: "phase1" };
      }

      if (job.name === SPEAKING_PHASE2_JOB) {
        await scoreSpeakingPhase2ById({ sessionId, force });
        return { sessionId, stage: "phase2" };
      }

      if (job.name === SPEAKING_SCORE_JOB) {
        await scoreSpeakingSessionById({ sessionId, force });
        return { sessionId, stage: "legacy_full" };
      }

      await scoreSpeakingSessionById({ sessionId, force });
      return { sessionId };
    },
    { connection: redisConnection, concurrency: speakingConcurrency },
  );

  const writingTaxonomyWorker = new Worker(
    WRITING_TAXONOMY_QUEUE,
    async (job) => {
      const { submissionId, force = false } = job.data || {};
      if (!submissionId) throw new Error("Missing submissionId");
      await enrichWritingTaxonomyBySubmissionId({ submissionId, force });
      return { submissionId };
    },
    { connection: redisConnection, concurrency: taxonomyConcurrency },
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
  writingTaxonomyWorker.on("completed", (job) => {
    log("Writing taxonomy job completed", { jobId: job.id });
  });
  writingTaxonomyWorker.on("failed", (job, err) => {
    log("Writing taxonomy job failed", { jobId: job?.id, error: err?.message });
  });

  log("AI workers started", {
    queues: [WRITING_AI_QUEUE, SPEAKING_AI_QUEUE, WRITING_TAXONOMY_QUEUE],
    writingConcurrency,
    speakingConcurrency,
    taxonomyConcurrency,
  });
};

main().catch((error) => {
  console.error("AI worker failed to start", error);
  process.exit(1);
});
