import { Queue } from "bullmq";
import {
  createRedisConnection,
  getAiQueueJobAttempts,
  getAiQueueJobBackoffMs,
  getAiQueueRemoveOnComplete,
  getAiQueueRemoveOnFail,
  isAiAsyncModeEnabled,
} from "../config/queue.config.js";

export const WRITING_AI_QUEUE = "writing-ai-grading";
export const SPEAKING_AI_QUEUE = "speaking-ai-grading";
export const WRITING_TAXONOMY_QUEUE = "writing-taxonomy-enrichment";
export const SPEAKING_SCORE_JOB = "score-speaking-session";
export const SPEAKING_PHASE1_JOB = "score-speaking-phase1";
export const SPEAKING_PHASE2_JOB = "score-speaking-phase2";

let redisConnection = null;
let writingQueue = null;
let speakingQueue = null;
let writingTaxonomyQueue = null;

const ensureQueues = () => {
  if (!isAiAsyncModeEnabled()) {
    return { ready: false, reason: "AI async mode is disabled" };
  }

  if (!redisConnection) {
    redisConnection = createRedisConnection();
  }

  if (!redisConnection) {
    return { ready: false, reason: "REDIS_URL is missing" };
  }

  if (!writingQueue) {
    writingQueue = new Queue(WRITING_AI_QUEUE, { connection: redisConnection });
  }

  if (!speakingQueue) {
    speakingQueue = new Queue(SPEAKING_AI_QUEUE, { connection: redisConnection });
  }

  if (!writingTaxonomyQueue) {
    writingTaxonomyQueue = new Queue(WRITING_TAXONOMY_QUEUE, { connection: redisConnection });
  }

  return { ready: true };
};

const addUniqueJob = async (queue, name, payload, jobId) => {
  try {
    const attempts = getAiQueueJobAttempts();
    const backoffDelay = getAiQueueJobBackoffMs();
    const removeOnComplete = getAiQueueRemoveOnComplete();
    const removeOnFail = getAiQueueRemoveOnFail();
    return await queue.add(name, payload, {
      jobId,
      attempts,
      backoff: { type: "exponential", delay: backoffDelay },
      removeOnComplete,
      removeOnFail,
    });
  } catch (error) {
    if (String(error?.message || "").includes("JobId")) {
      const existingJob = await queue.getJob(jobId);
      if (existingJob) return existingJob;
    }
    throw error;
  }
};

export const isAiQueueReady = () => ensureQueues().ready;

const buildSafeJobId = (prefix, rawId) => {
  const normalizedId = String(rawId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${prefix}-${normalizedId}`;
};

export const enqueueWritingAiScoreJob = async ({ submissionId, force = false }) => {
  const state = ensureQueues();
  if (!state.ready) {
    return {
      queued: false,
      reason: state.reason,
      queue: WRITING_AI_QUEUE,
      jobId: null,
    };
  }

  const jobId = buildSafeJobId("writing-submission", submissionId);
  const job = await addUniqueJob(
    writingQueue,
    "score-writing-submission",
    { submissionId, force },
    jobId,
  );

  return {
    queued: true,
    queue: WRITING_AI_QUEUE,
    jobId: String(job.id),
  };
};

export const enqueueSpeakingAiScoreJob = async ({ sessionId, force = false }) => {
  const state = ensureQueues();
  if (!state.ready) {
    return {
      queued: false,
      reason: state.reason,
      queue: SPEAKING_AI_QUEUE,
      jobId: null,
    };
  }

  const jobId = buildSafeJobId("speaking-session", sessionId);
  const job = await addUniqueJob(
    speakingQueue,
    SPEAKING_SCORE_JOB,
    { sessionId, force },
    jobId,
  );

  return {
    queued: true,
    queue: SPEAKING_AI_QUEUE,
    jobId: String(job.id),
  };
};

export const enqueueSpeakingAiPhase1Job = async ({ sessionId, force = false }) => {
  const state = ensureQueues();
  if (!state.ready) {
    return {
      queued: false,
      reason: state.reason,
      queue: SPEAKING_AI_QUEUE,
      jobId: null,
    };
  }

  const jobId = buildSafeJobId("speaking-session-phase1", sessionId);
  const job = await addUniqueJob(
    speakingQueue,
    SPEAKING_PHASE1_JOB,
    { sessionId, force },
    jobId,
  );

  return {
    queued: true,
    queue: SPEAKING_AI_QUEUE,
    jobId: String(job.id),
  };
};

export const enqueueSpeakingAiPhase2Job = async ({ sessionId, force = false }) => {
  const state = ensureQueues();
  if (!state.ready) {
    return {
      queued: false,
      reason: state.reason,
      queue: SPEAKING_AI_QUEUE,
      jobId: null,
    };
  }

  const jobId = buildSafeJobId("speaking-session-phase2", sessionId);
  const job = await addUniqueJob(
    speakingQueue,
    SPEAKING_PHASE2_JOB,
    { sessionId, force },
    jobId,
  );

  return {
    queued: true,
    queue: SPEAKING_AI_QUEUE,
    jobId: String(job.id),
  };
};

export const enqueueWritingTaxonomyEnrichmentJob = async ({ submissionId, force = false }) => {
  const state = ensureQueues();
  if (!state.ready) {
    return {
      queued: false,
      reason: state.reason,
      queue: WRITING_TAXONOMY_QUEUE,
      jobId: null,
    };
  }

  const jobId = buildSafeJobId("writing-taxonomy", submissionId);
  const job = await addUniqueJob(
    writingTaxonomyQueue,
    "enrich-writing-taxonomy",
    { submissionId, force },
    jobId,
  );

  return {
    queued: true,
    queue: WRITING_TAXONOMY_QUEUE,
    jobId: String(job.id),
  };
};
