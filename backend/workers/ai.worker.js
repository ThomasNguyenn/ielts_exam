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
      log("Speaking job started", {
        jobId: job.id,
        jobName: job.name,
        sessionId,
        force: Boolean(force),
      });

      if (job.name === SPEAKING_PHASE1_JOB) {
        const phase1Result = await scoreSpeakingPhase1ById({ sessionId, force });
        const phase1Analysis = phase1Result?.phase1Analysis || phase1Result?.session?.phase1_analysis || null;
        log("Speaking phase1 result", {
          jobId: job.id,
          sessionId,
          phase1Source: phase1Result?.phase1Source || phase1Result?.session?.phase1_source || null,
          fallbackUsed: Boolean(phase1Result?.fallbackUsed),
          skipped: Boolean(phase1Result?.skipped),
          phase1_contract_payload: phase1Analysis
            ? {
              lexical_resource: {
                score: phase1Analysis?.lexical_resource?.score ?? null,
                feedback: phase1Analysis?.lexical_resource?.feedback ?? null,
              },
              grammatical_range: {
                score: phase1Analysis?.grammatical_range?.score ?? null,
                feedback: phase1Analysis?.grammatical_range?.feedback ?? null,
              },
              vocabulary_upgrades: Array.isArray(phase1Analysis?.vocabulary_upgrades) ? phase1Analysis.vocabulary_upgrades : [],
              grammar_corrections: Array.isArray(phase1Analysis?.grammar_corrections) ? phase1Analysis.grammar_corrections : [],
              general_feedback: phase1Analysis?.general_feedback ?? null,
              error_logs: Array.isArray(phase1Analysis?.error_logs) ? phase1Analysis.error_logs : [],
            }
            : null,
        });
        return { sessionId, stage: "phase1" };
      }

      if (job.name === SPEAKING_PHASE2_JOB) {
        const phase2Result = await scoreSpeakingPhase2ById({ sessionId, force });
        const analysis = phase2Result?.analysis || phase2Result?.session?.analysis || null;
        const phase2Session = phase2Result?.session || null;
        log("Speaking phase2 result", {
          jobId: job.id,
          sessionId,
          aiSource: phase2Result?.aiSource || phase2Result?.session?.ai_source || null,
          skipped: Boolean(phase2Result?.skipped),
          fallbackUsed: Boolean(phase2Result?.phase2FallbackUsed),
          status: phase2Session?.status || null,
          scoring_state: phase2Session?.scoring_state || null,
          phase1_ready: Boolean(phase2Session?.phase1_analysis),
          phase2_ready: Boolean(phase2Session?.phase2_analysis),
          finalized: Boolean(analysis) && String(phase2Session?.status || "").toLowerCase() === "completed",
          final_scores: analysis
            ? {
              band_score: analysis?.band_score ?? null,
              fluency_coherence: analysis?.fluency_coherence?.score ?? null,
              lexical_resource: analysis?.lexical_resource?.score ?? null,
              grammatical_range: analysis?.grammatical_range?.score ?? null,
              pronunciation: analysis?.pronunciation?.score ?? null,
            }
            : null,
        });
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
    log("Speaking job failed", {
      jobId: job?.id,
      jobName: job?.name || null,
      sessionId: job?.data?.sessionId || null,
      error: err?.message || null,
      code: err?.code || null,
      name: err?.name || null,
      stack: err?.stack || null,
    });
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
