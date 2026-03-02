import dotenv from "dotenv";
import { Worker } from "bullmq";
import { connectDB } from "../config/db.js";
import { validateWorkerEnvironment } from "../config/env.validation.js";
import SpeakingSession from "../models/SpeakingSession.js";
import {
  createRedisConnection,
  getSpeakingWorkerConcurrency,
  getTaxonomyWorkerConcurrency,
  getWritingWorkerConcurrency,
  isAiAsyncModeEnabled,
} from "../config/queue.config.js";
import {
  enqueueSpeakingAiPhase1Job,
  enqueueSpeakingAiPhase2Job,
  enqueueSpeakingErrorLogsJob,
  SPEAKING_ERROR_LOGS_JOB,
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

const SPEAKING_STUCK_THRESHOLD_MS = Math.max(
  1_000,
  Number(process.env.SPEAKING_STUCK_THRESHOLD_MS || 60_000),
);
const SPEAKING_AUTO_REQUEUE_LIMIT_PER_PHASE = 1;

const getSessionAgeMs = (session = {}) => {
  const timestamp = new Date(session?.timestamp || session?.createdAt || Date.now()).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Date.now() - timestamp);
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
  const [{ scoreWritingSubmissionById }, {
    finalizeSpeakingSessionById,
    isUsableSpeakingAnalysis,
    scoreSpeakingErrorLogsById,
    scoreSpeakingSessionById,
    scoreSpeakingPhase1ById,
    scoreSpeakingPhase2ById,
  }, { enrichWritingTaxonomyBySubmissionId }] = await Promise.all([
    import("../services/writingSubmissionScoring.service.js"),
    import("../services/speakingGrading.service.js"),
    import("../services/writingTaxonomyEnrichment.service.js"),
  ]);

  const consumeAutoRequeueAllowance = async ({ sessionId, phase }) => {
    const normalizedPhase = String(phase || "").trim().toLowerCase();
    if (!["phase1", "phase2"].includes(normalizedPhase)) return null;

    const countField = normalizedPhase === "phase1"
      ? "phase1_auto_requeue_count"
      : "phase2_auto_requeue_count";
    const lastField = normalizedPhase === "phase1"
      ? "phase1_last_requeue_at"
      : "phase2_last_requeue_at";

    return SpeakingSession.findOneAndUpdate(
      {
        _id: sessionId,
        status: { $ne: "completed" },
        $or: [
          { [countField]: { $exists: false } },
          { [countField]: { $lt: SPEAKING_AUTO_REQUEUE_LIMIT_PER_PHASE } },
        ],
      },
      {
        $inc: { [countField]: 1 },
        $set: { [lastField]: new Date() },
      },
      { new: true },
    );
  };

  const runSpeakingAutoHeal = async ({
    sessionId,
    fromStage,
    sessionSnapshot,
  } = {}) => {
    const stage = String(fromStage || "").trim().toLowerCase();
    if (!sessionId || !["phase1", "phase2"].includes(stage)) return;

    let latestSession = sessionSnapshot || await SpeakingSession.findById(sessionId);
    if (!latestSession) return;

    const hasPhase1 = isUsableSpeakingAnalysis(latestSession?.phase1_analysis);
    const hasPhase2 = isUsableSpeakingAnalysis(latestSession?.phase2_analysis);
    const hasFinalAnalysis = isUsableSpeakingAnalysis(latestSession?.analysis);

    if (hasPhase1 && hasPhase2 && !hasFinalAnalysis) {
      const finalizeResult = await finalizeSpeakingSessionById({ sessionId });
      latestSession = finalizeResult?.session || latestSession;
      log("speaking_finalize_repair_triggered", {
        sessionId,
        from_stage: stage,
        finalized: Boolean(finalizeResult?.finalized),
        reason: finalizeResult?.reason || null,
      });
    }

    const refreshedHasPhase1 = isUsableSpeakingAnalysis(latestSession?.phase1_analysis);
    const refreshedHasPhase2 = isUsableSpeakingAnalysis(latestSession?.phase2_analysis);
    if (refreshedHasPhase1 && refreshedHasPhase2) return;

    const sessionAgeMs = getSessionAgeMs(latestSession);
    if (sessionAgeMs < SPEAKING_STUCK_THRESHOLD_MS) {
      log("speaking_auto_requeue_skipped_guardrail", {
        sessionId,
        from_stage: stage,
        reason: "below_stuck_threshold",
        session_age_ms: sessionAgeMs,
        threshold_ms: SPEAKING_STUCK_THRESHOLD_MS,
      });
      return;
    }

    if (stage === "phase2" && !refreshedHasPhase1) {
      const allowance = await consumeAutoRequeueAllowance({ sessionId, phase: "phase1" });
      if (!allowance) {
        log("speaking_auto_requeue_skipped_guardrail", {
          sessionId,
          from_stage: stage,
          reason: "phase1_guardrail_exhausted",
          phase1_auto_requeue_count: latestSession?.phase1_auto_requeue_count || 0,
        });
        return;
      }

      const repairTag = `autoheal-${Date.now()}`;
      const queueResult = await enqueueSpeakingAiPhase1Job({
        sessionId,
        force: true,
        repairTag,
      });
      log("speaking_auto_requeue_phase1_triggered", {
        sessionId,
        from_stage: stage,
        repair_tag: repairTag,
        queued: Boolean(queueResult?.queued),
        job_id: queueResult?.jobId || null,
        reason: queueResult?.reason || null,
      });
      return;
    }

    if (stage === "phase1" && !refreshedHasPhase2) {
      const uploadState = String(latestSession?.audio_upload_state || "").trim().toLowerCase();
      if (!["ready", "failed"].includes(uploadState)) {
        log("speaking_auto_requeue_skipped_guardrail", {
          sessionId,
          from_stage: stage,
          reason: "phase2_audio_not_ready",
          audio_upload_state: uploadState || null,
        });
        return;
      }

      const allowance = await consumeAutoRequeueAllowance({ sessionId, phase: "phase2" });
      if (!allowance) {
        log("speaking_auto_requeue_skipped_guardrail", {
          sessionId,
          from_stage: stage,
          reason: "phase2_guardrail_exhausted",
          phase2_auto_requeue_count: latestSession?.phase2_auto_requeue_count || 0,
        });
        return;
      }

      const repairTag = `autoheal-${Date.now()}`;
      const queueResult = await enqueueSpeakingAiPhase2Job({
        sessionId,
        force: true,
        repairTag,
      });
      log("speaking_auto_requeue_phase2_triggered", {
        sessionId,
        from_stage: stage,
        repair_tag: repairTag,
        queued: Boolean(queueResult?.queued),
        job_id: queueResult?.jobId || null,
        reason: queueResult?.reason || null,
      });
    }
  };

  const maybeEnqueueSpeakingErrorLogsJob = async ({
    sessionId,
    sessionSnapshot = null,
    trigger = "",
  } = {}) => {
    if (!sessionId) return null;

    const latestSession = sessionSnapshot || await SpeakingSession.findById(sessionId);
    if (!latestSession) return null;

    const status = String(latestSession?.status || "").trim().toLowerCase();
    const errorLogsState = String(latestSession?.error_logs_state || "").trim().toLowerCase();
    if (status !== "completed" || errorLogsState !== "pending") {
      return null;
    }

    const queueResult = await enqueueSpeakingErrorLogsJob({ sessionId });
    log("speaking_error_logs_job_enqueued", {
      sessionId,
      trigger: trigger || null,
      queued: Boolean(queueResult?.queued),
      job_id: queueResult?.jobId || null,
      reason: queueResult?.reason || null,
    });
    return queueResult;
  };

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
        await runSpeakingAutoHeal({
          sessionId,
          fromStage: "phase1",
          sessionSnapshot: phase1Result?.session || null,
        }).catch((autoHealError) => {
          log("speaking_autoheal_error", {
            sessionId,
            from_stage: "phase1",
            error: autoHealError?.message || null,
          });
        });
        await maybeEnqueueSpeakingErrorLogsJob({
          sessionId,
          trigger: "phase1_completed",
        }).catch((enqueueError) => {
          log("speaking_error_logs_enqueue_failed", {
            sessionId,
            trigger: "phase1_completed",
            error: enqueueError?.message || null,
          });
        });
        return { sessionId, stage: "phase1" };
      }

      if (job.name === SPEAKING_PHASE2_JOB) {
        const phase2Result = await scoreSpeakingPhase2ById({ sessionId, force });
        const analysis = phase2Result?.analysis || phase2Result?.session?.analysis || null;
        const phase2Session = phase2Result?.session || null;
        const hasUsableFinalAnalysis = isUsableSpeakingAnalysis(analysis);
        log("Speaking phase2 result", {
          jobId: job.id,
          sessionId,
          aiSource: phase2Result?.aiSource || phase2Result?.session?.ai_source || null,
          skipped: Boolean(phase2Result?.skipped),
          fallbackUsed: Boolean(phase2Result?.phase2FallbackUsed),
          status: phase2Session?.status || null,
          scoring_state: phase2Session?.scoring_state || null,
          phase1_ready: isUsableSpeakingAnalysis(phase2Session?.phase1_analysis),
          phase2_ready: isUsableSpeakingAnalysis(phase2Session?.phase2_analysis),
          finalized: hasUsableFinalAnalysis && String(phase2Session?.status || "").toLowerCase() === "completed",
          final_scores: hasUsableFinalAnalysis
            ? {
              band_score: analysis?.band_score ?? null,
              fluency_coherence: analysis?.fluency_coherence?.score ?? null,
              lexical_resource: analysis?.lexical_resource?.score ?? null,
              grammatical_range: analysis?.grammatical_range?.score ?? null,
              pronunciation: analysis?.pronunciation?.score ?? null,
            }
            : null,
        });
        await runSpeakingAutoHeal({
          sessionId,
          fromStage: "phase2",
          sessionSnapshot: phase2Session,
        }).catch((autoHealError) => {
          log("speaking_autoheal_error", {
            sessionId,
            from_stage: "phase2",
            error: autoHealError?.message || null,
          });
        });
        await maybeEnqueueSpeakingErrorLogsJob({
          sessionId,
          trigger: "phase2_completed",
        }).catch((enqueueError) => {
          log("speaking_error_logs_enqueue_failed", {
            sessionId,
            trigger: "phase2_completed",
            error: enqueueError?.message || null,
          });
        });
        return { sessionId, stage: "phase2" };
      }

      if (job.name === SPEAKING_ERROR_LOGS_JOB) {
        log("speaking_error_logs_processing", {
          jobId: job.id,
          sessionId,
          force: Boolean(force),
        });
        const errorLogsResult = await scoreSpeakingErrorLogsById({ sessionId, force });
        log("speaking_error_logs_ready", {
          jobId: job.id,
          sessionId,
          state: errorLogsResult?.session?.error_logs_state || null,
          source: errorLogsResult?.session?.error_logs_source || errorLogsResult?.errorLogsSource || null,
          error_logs_count: Array.isArray(errorLogsResult?.session?.analysis?.error_logs)
            ? errorLogsResult.session.analysis.error_logs.length
            : null,
          skipped: Boolean(errorLogsResult?.skipped),
          reason: errorLogsResult?.reason || null,
        });
        return { sessionId, stage: "error_logs" };
      }

      if (job.name === SPEAKING_SCORE_JOB) {
        await scoreSpeakingSessionById({ sessionId, force });
        await maybeEnqueueSpeakingErrorLogsJob({
          sessionId,
          trigger: "legacy_full_completed",
        }).catch((enqueueError) => {
          log("speaking_error_logs_enqueue_failed", {
            sessionId,
            trigger: "legacy_full_completed",
            error: enqueueError?.message || null,
          });
        });
        return { sessionId, stage: "legacy_full" };
      }

      await scoreSpeakingSessionById({ sessionId, force });
      await maybeEnqueueSpeakingErrorLogsJob({
        sessionId,
        trigger: "fallback_full_completed",
      }).catch((enqueueError) => {
        log("speaking_error_logs_enqueue_failed", {
          sessionId,
          trigger: "fallback_full_completed",
          error: enqueueError?.message || null,
        });
      });
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
    if (job?.name === SPEAKING_ERROR_LOGS_JOB) {
      log("speaking_error_logs_failed", {
        jobId: job?.id,
        sessionId: job?.data?.sessionId || null,
        error: err?.message || null,
        code: err?.code || null,
      });
    }
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
