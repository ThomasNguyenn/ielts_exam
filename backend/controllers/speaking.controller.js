import Speaking from "../models/Speaking.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import cloudinary from "../utils/cloudinary.js";
import { isAiAsyncModeEnabled } from "../config/queue.config.js";
import {
  enqueueSpeakingAiPhase1Job,
  enqueueSpeakingAiScoreJob,
  isAiQueueReady,
} from "../queues/ai.queue.js";
import { scoreSpeakingSessionById } from "../services/speakingGrading.service.js";
import { evaluateSpeakingProvisionalScore } from "../services/speakingFastScore.service.js";
import { ensurePart3ConversationScript, generatePromptReadAloudPreview } from "../services/speakingReadAloud.service.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeTopicList = (values = []) => {
  const normalized = [];

  values.forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        const topic = String(item || "").trim();
        if (topic) normalized.push(topic);
      });
      return;
    }

    const topic = String(value || "").trim();
    if (topic) normalized.push(topic);
  });

  return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b));
};

const canAccessSession = (session, user) => {
  if (!session) return false;
  if (!user?.userId) return false;
  if (!session.userId) return user.role === "admin" || user.role === "teacher";
  if (String(session.userId) === String(user.userId)) return true;
  return user.role === "admin" || user.role === "teacher";
};

const SPEAKING_FAST_SCORE_TIMEOUT_MS = Number(process.env.SPEAKING_FAST_SCORE_TIMEOUT_MS || 3500);
const SPEAKING_TWO_PHASE_PIPELINE = ["1", "true", "yes", "on"].includes(
  String(process.env.SPEAKING_TWO_PHASE_PIPELINE ?? "true").trim().toLowerCase(),
);

const deriveScoringState = (session) => {
  const explicitState = String(session?.scoring_state || "").trim();
  if (explicitState) return explicitState;

  const status = String(session?.status || "").trim();
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
};

const withTimeout = async (promise, timeoutMs, timeoutMessage) => {
  let timerHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timerHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timerHandle);
  }
};

const normalizeCueCardText = (value = "") => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join("\n");
  }
  return String(value || "").trim();
};

const normalizePart2QuestionTitle = (value = "") => String(value || "").trim();

const toPartNumber = (value) => {
  const parsed = Number.parseInt(value, 10);
  return [1, 2, 3].includes(parsed) ? parsed : null;
};

const applyPart2Consistency = (payload = {}, existingTopic = null) => {
  const hasIncomingPart = Object.prototype.hasOwnProperty.call(payload, "part");
  const incomingPart = hasIncomingPart ? toPartNumber(payload.part) : null;
  const effectivePart = incomingPart ?? toPartNumber(existingTopic?.part);

  if (effectivePart === 2) {
    const resolvedPart2Title = [
      payload.part2_question_title,
      payload.prompt,
      existingTopic?.part2_question_title,
      existingTopic?.prompt,
      "",
    ]
      .map((item) => String(item || "").trim())
      .find(Boolean) || "";

    payload.part2_question_title = resolvedPart2Title;
    payload.prompt = resolvedPart2Title;
  }

  if (hasIncomingPart && incomingPart !== 2) {
    payload.part2_question_title = "";
  }

  return payload;
};

const pickSpeakingPayload = (body = {}, { allowId = false } = {}) => {
  const allowed = [
    "title",
    "part",
    "prompt",
    "part2_question_title",
    "cue_card",
    "sub_questions",
    "image_url",
    "read_aloud",
    "keywords",
    "sample_highlights",
    "is_active",
  ];

  if (allowId) {
    allowed.push("_id");
  }

  const payload = allowed.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      acc[field] = body[field];
    }
    return acc;
  }, {});

  if (Object.prototype.hasOwnProperty.call(payload, "cue_card")) {
    payload.cue_card = normalizeCueCardText(payload.cue_card);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "part2_question_title")) {
    payload.part2_question_title = normalizePart2QuestionTitle(payload.part2_question_title);
  }

  return payload;
};

const uploadSpeakingAudio = async (audioFile) => {
  if (!audioFile?.buffer) {
    throw new Error("Audio buffer is missing");
  }

  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({
      folder: "ielts-speaking-recordings",
      resource_type: "video",
      use_filename: false,
      unique_filename: true,
    }, (error, streamResult) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(streamResult);
    });

    uploadStream.on("error", reject);
    uploadStream.end(audioFile.buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

export const getRandomSpeaking = async (req, res) => {
  try {
    const count = await Speaking.countDocuments({ is_active: true });
    if (count === 0) {
      return sendControllerError(req, res, { statusCode: 404, message: "No speaking topics found"  });
    }
    const random = Math.floor(Math.random() * count);
    const topic = await Speaking.findOne({ is_active: true }).skip(random);

    if (!topic) {
      return sendControllerError(req, res, { statusCode: 404, message: "No speaking topics found"  });
    }

    return res.json({ success: true, data: topic });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getSpeakings = async (req, res) => {
  try {
    const isTopicsOnly = String(req.query.topicsOnly || '').toLowerCase() === 'true';

    if (isTopicsOnly) {
      // Do not use `distinct` here because it is blocked under Mongo API Version 1 with apiStrict=true.
      const docs = await Speaking.find({ is_active: true }).select({ title: 1, _id: 0 }).lean();
      const topics = docs.map((doc) => doc?.title);
      return res.json({ success: true, topics: normalizeTopicList(topics) });
    }

    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
    const filter = { is_active: true };

    if (req.query.part && String(req.query.part).trim() !== 'all') {
      const part = Number.parseInt(req.query.part, 10);
      if ([1, 2, 3].includes(part)) {
        filter.part = part;
      }
    }

    if (req.query.topic && String(req.query.topic).trim() && String(req.query.topic).trim().toLowerCase() !== 'all') {
      const normalizedTopic = String(req.query.topic).trim();
      // Avoid strict equality mismatch from historical data with casing/whitespace inconsistencies.
      filter.title = new RegExp(`^\\s*${escapeRegex(normalizedTopic)}\\s*$`, 'i');
    }

    if (req.query.q && String(req.query.q).trim()) {
      const safeRegex = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      filter.$or = [
        { title: safeRegex },
        { prompt: safeRegex },
        { part2_question_title: safeRegex },
        { cue_card: safeRegex }
      ];
    }

    const baseQuery = Speaking.find(filter).sort({ created_at: -1 });

    if (!shouldPaginate) {
      const topics = await baseQuery;
      return res.json({ success: true, data: topics });
    }

    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 100 });
    const [topics, totalItems] = await Promise.all([
      baseQuery.skip(skip).limit(limit),
      Speaking.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data: topics,
      pagination: buildPaginationMeta({ page, limit, totalItems })
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getSpeakingById = async (req, res) => {
  try {
    const topic = await Speaking.findById(req.params.id);
    if (!topic) {
      return sendControllerError(req, res, { statusCode: 404, message: "Speaking topic not found"  });
    }

    const conversationScript = await ensurePart3ConversationScript(topic);
    const payload = topic.toObject();
    if (conversationScript) {
      payload.conversation_script = conversationScript;
    }

    return res.json({ success: true, data: payload });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const preGeneratePart3ReadAloud = async (req, res) => {
  try {
    const topics = await Speaking.find({ part: 3 }).sort({ created_at: -1 });

    const summary = {
      totalTopics: topics.length,
      topicsWithQuestions: 0,
      topicsGenerated: 0,
      topicsAlreadyReady: 0,
      topicsUnavailable: 0,
      totalGeneratedAudios: 0,
      totalReadyAudios: 0,
      failedTopics: [],
    };

    for (const topic of topics) {
      try {
        const result = await ensurePart3ConversationScript(topic, { includeStats: true });
        const script = result?.script;
        const stats = result?.stats || {};
        const questions = Array.isArray(script?.questions) ? script.questions : [];
        const totalQuestions = questions.length;
        const readyQuestions = questions.filter((item) => item.audio_status === "ready").length;

        if (totalQuestions > 0) {
          summary.topicsWithQuestions += 1;
          summary.totalReadyAudios += readyQuestions;
        }

        if (Number(stats.generatedItemCount || 0) > 0) {
          summary.topicsGenerated += 1;
          summary.totalGeneratedAudios += Number(stats.generatedItemCount || 0);
        } else if (totalQuestions > 0 && readyQuestions === totalQuestions) {
          summary.topicsAlreadyReady += 1;
        } else if (totalQuestions > 0) {
          summary.topicsUnavailable += 1;
        }
      } catch (topicError) {
        summary.failedTopics.push({
          topicId: topic._id,
          title: topic.title || "",
          message: topicError.message,
        });
      }
    }

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
        return handleControllerError(req, res, error);
  }
};

export const generateSpeakingPromptReadAloud = async (req, res) => {
  try {
    const {
      topicId = "preview",
      prompt = "",
      provider = "openai",
      model,
      voice,
      speed,
    } = req.body || {};

    const generated = await generatePromptReadAloudPreview({
      topicId,
      prompt,
      provider,
      model,
      voice,
      speed,
    });

    return res.json({
      success: true,
      data: generated,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return handleControllerError(req, res, error, {
      statusCode,
      message: error.message || "Server Error",
    });
  }
};

export const getSpeakingSession = async (req, res) => {
  try {
    const session = await SpeakingSession.findById(req.params.id).lean();
    if (!session) {
      return sendControllerError(req, res, { statusCode: 404, message: "Speaking session not found"  });
    }

    if (!canAccessSession(session, req.user)) {
      return sendControllerError(req, res, { statusCode: 403, message: "Forbidden"  });
    }

    return res.json({
      success: true,
      data: {
        session_id: session._id,
        question_id: session.questionId || null,
        status: session.status,
        scoring_state: deriveScoringState(session),
        transcript: session.transcript || "",
        analysis: session.analysis || null,
        ai_source: session.ai_source || null,
        phase2_source: session.phase2_source || null,
        provisional_analysis: session.provisional_analysis || null,
        provisional_source: session.provisional_source || null,
        provisional_ready_at: session.provisional_ready_at || null,
        phase1_analysis: session.phase1_analysis || null,
        phase1_source: session.phase1_source || null,
        phase1_ready_at: session.phase1_ready_at || null,
        metrics: session.metrics || { wpm: 0, pauses: {} },
        timestamp: session.timestamp || session.createdAt || null,
        audio_deleted_at: session.audioDeletedAt || null,
      },
    });
  } catch (error) {
        return handleControllerError(req, res, error);
  }
};

export const createSpeaking = async (req, res) => {
  try {
    const payload = pickSpeakingPayload(req.body, { allowId: true });
    applyPart2Consistency(payload);
    const newTopic = new Speaking(payload);
    const savedTopic = await newTopic.save();
    return res.status(201).json({ success: true, data: savedTopic });
  } catch (error) {
    return sendControllerError(req, res, { statusCode: 400, message: error.message  });
  }
};

export const updateSpeaking = async (req, res) => {
  try {
    const payload = pickSpeakingPayload(req.body);
    if (Object.keys(payload).length === 0) {
      return sendControllerError(req, res, { statusCode: 400, message: "No valid update fields provided"  });
    }

    const existingTopic = await Speaking.findById(req.params.id);
    if (!existingTopic) {
      return sendControllerError(req, res, { statusCode: 404, message: "Speaking topic not found"  });
    }

    applyPart2Consistency(payload, existingTopic);

    const updatedTopic = await Speaking.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true },
    );
    if (!updatedTopic) {
      return sendControllerError(req, res, { statusCode: 404, message: "Speaking topic not found"  });
    }
    return res.json({ success: true, data: updatedTopic });
  } catch (error) {
    return sendControllerError(req, res, { statusCode: 400, message: error.message  });
  }
};

export const deleteSpeaking = async (req, res) => {
  try {
    const topic = await Speaking.findByIdAndDelete(req.params.id);
    if (!topic) {
      return sendControllerError(req, res, { statusCode: 404, message: "Speaking topic not found"  });
    }
    return res.json({ success: true, message: "Speaking topic deleted successfully" });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const submitSpeaking = async (req, res) => {
  let session = null;
  try {
    const { questionId, transcript: clientTranscript = "", wpm, metrics } = req.body;
    const userId = req.user?.userId;
    const audioFile = req.file;

    if (!audioFile) {
      return sendControllerError(req, res, { statusCode: 400, message: "Audio file is required"  });
    }

    const topic = await Speaking.findById(questionId).select("_id");
    if (!topic) {
      return sendControllerError(req, res, { statusCode: 404, message: "Speaking topic not found"  });
    }

    const uploadedAudio = await uploadSpeakingAudio(audioFile);

    let parsedMetrics = {};
    try {
      parsedMetrics = typeof metrics === "string" ? JSON.parse(metrics) : (metrics || {});
    } catch {
      parsedMetrics = {};
    }

    session = new SpeakingSession({
      questionId,
      userId: userId || undefined,
      audioUrl: uploadedAudio.url,
      audioPublicId: uploadedAudio.publicId || null,
      audioMimeType: audioFile.mimetype || "audio/webm",
      transcript: clientTranscript || "",
      analysis: undefined,
      metrics: {
        wpm: Number(wpm || 0),
        pauses: parsedMetrics,
      },
      status: "processing",
    });
    await session.save();

    const provisionalStartAt = Date.now();
    try {
      const fastScoreResult = await withTimeout(
        evaluateSpeakingProvisionalScore({
          audioBuffer: audioFile.buffer,
          mimeType: audioFile.mimetype || "audio/webm",
          metrics: parsedMetrics,
          wpm: Number(wpm || 0),
          fallbackTranscript: clientTranscript || "",
        }),
        SPEAKING_FAST_SCORE_TIMEOUT_MS,
        `Fast score timed out after ${SPEAKING_FAST_SCORE_TIMEOUT_MS}ms`,
      );

      if (fastScoreResult?.provisionalAnalysis) {
        session.provisional_analysis = fastScoreResult.provisionalAnalysis;
        session.provisional_source = fastScoreResult.provisionalSource || "formula_v1";
        session.provisional_ready_at = new Date();
        session.scoring_state = "provisional_ready";
        const fastTranscript = String(fastScoreResult.transcript || "").trim();
        const sttSource = String(fastScoreResult.sttSource || "").trim();
        const isClientFallbackSource = sttSource === "client_transcript_fallback";

        // Prefer backend STT transcript as canonical transcript.
        // Only avoid overwrite when fast pipeline itself fell back to client transcript.
        if (fastTranscript && (!isClientFallbackSource || !String(session.transcript || "").trim())) {
          session.transcript = fastTranscript;
        }
        await session.save();

        console.log(JSON.stringify({
          event: "speaking_fast_score_ready",
          session_id: String(session._id),
          submit_to_provisional_ms: Date.now() - provisionalStartAt,
          stt_source: fastScoreResult.sttSource || null,
          stt_error_rate: 0,
        }));
      }
    } catch (fastScoreError) {
      console.warn("Speaking fast score skipped:", fastScoreError.message);
      console.log(JSON.stringify({
        event: "speaking_fast_score_error",
        session_id: String(session._id),
        submit_to_provisional_ms: Date.now() - provisionalStartAt,
        stt_error_rate: 1,
        error: fastScoreError.message,
      }));
    }

    let xpResult = null;
    let newlyUnlocked = [];
    if (userId) {
      const { addXP, XP_SPEAKING_SESSION } = await import("../services/gamification.service.js");
      xpResult = await addXP(userId, XP_SPEAKING_SESSION, 'speaking');

      const { checkAchievements } = await import("../services/achievement.service.js");
      newlyUnlocked = await checkAchievements(userId);
    }

    const asyncModeEnabled = isAiAsyncModeEnabled();
    const queueReady = isAiQueueReady();
    const shouldQueue = asyncModeEnabled && queueReady;
    const hasUserId = Boolean(userId);
    const canUseAsyncQueue = shouldQueue && hasUserId;
    let syncFallbackReason = "";

    console.log(JSON.stringify({
      event: "speaking_queue_decision",
      session_id: String(session._id),
      async_mode_enabled: asyncModeEnabled,
      queue_ready: queueReady,
      should_queue: shouldQueue,
      has_user_id: hasUserId,
      can_use_async_queue: canUseAsyncQueue,
      two_phase_pipeline: SPEAKING_TWO_PHASE_PIPELINE,
    }));

    if (shouldQueue && !userId) {
      console.warn("Speaking async queue skipped: missing authenticated user, falling back to sync scoring");
      syncFallbackReason = "missing_user_id";
    }

    if (canUseAsyncQueue) {
      try {
        const queueResult = SPEAKING_TWO_PHASE_PIPELINE
          ? await enqueueSpeakingAiPhase1Job({ sessionId: String(session._id) })
          : await enqueueSpeakingAiScoreJob({ sessionId: String(session._id) });
        console.log(JSON.stringify({
          event: "speaking_queue_enqueue_result",
          session_id: String(session._id),
          queued: Boolean(queueResult?.queued),
          queue: queueResult?.queue || null,
          job_id: queueResult?.jobId || null,
          reason: queueResult?.reason || null,
        }));
        if (queueResult.queued) {
          return res.status(202).json({
            success: true,
            session_id: session._id,
            question_id: session.questionId || null,
            status: "processing",
            scoring_state: deriveScoringState(session),
            queued: true,
            job_id: queueResult.jobId,
            transcript: session.transcript || "",
            provisional_analysis: session.provisional_analysis || null,
            provisional_source: session.provisional_source || null,
            provisional_ready_at: session.provisional_ready_at || null,
            phase2_source: session.phase2_source || null,
            phase1_analysis: session.phase1_analysis || null,
            phase1_source: session.phase1_source || null,
            phase1_ready_at: session.phase1_ready_at || null,
            metrics: session.metrics || { wpm: 0, pauses: {} },
            timestamp: session.timestamp || session.createdAt || null,
            xpResult,
            achievements: newlyUnlocked
          });
        }
        syncFallbackReason = queueResult?.reason
          ? `queue_not_queued:${queueResult.reason}`
          : "queue_not_queued";
      } catch (queueError) {
        console.warn("Speaking enqueue failed, falling back to sync scoring:", queueError.message);
        syncFallbackReason = `enqueue_error:${queueError.message}`;
      }
    } else if (!syncFallbackReason) {
      syncFallbackReason = shouldQueue ? "queue_ineligible" : "queue_disabled_or_unready";
    }

    console.log(JSON.stringify({
      event: "speaking_sync_fallback_scoring",
      session_id: String(session._id),
      reason: syncFallbackReason || "unknown",
    }));
    const grading = await scoreSpeakingSessionById({ sessionId: String(session._id), force: true });
    return res.json({
      success: true,
      session_id: grading.session._id,
      question_id: grading.session.questionId || null,
      status: grading.session.status,
      scoring_state: deriveScoringState(grading.session),
      transcript: grading.session?.transcript || grading.analysis?.transcript || "",
      analysis: grading.analysis || null,
      ai_source: grading.aiSource,
      phase2_source: grading.session?.phase2_source || null,
      provisional_analysis: grading.session?.provisional_analysis || null,
      provisional_source: grading.session?.provisional_source || null,
      provisional_ready_at: grading.session?.provisional_ready_at || null,
      phase1_analysis: grading.session?.phase1_analysis || null,
      phase1_source: grading.session?.phase1_source || null,
      phase1_ready_at: grading.session?.phase1_ready_at || null,
      metrics: grading.session?.metrics || { wpm: 0, pauses: {} },
      timestamp: grading.session?.timestamp || grading.session?.createdAt || null,
      queued: false,
      xpResult,
      achievements: newlyUnlocked
    });
  } catch (error) {
    if (session?._id) {
      await SpeakingSession.findByIdAndUpdate(session._id, { status: "failed", scoring_state: "failed" }).catch(() => { });
    }
    const statusCode = Number(error?.statusCode || error?.status || 500);
    const message = String(error?.message || "").trim() || "Error when processing audio";
    console.error(JSON.stringify({
      event: "speaking_submit_error",
      session_id: session?._id ? String(session._id) : null,
      status_code: statusCode,
      message,
      code: String(error?.code || ""),
    }));
    return handleControllerError(req, res, error, {
      statusCode,
      message,
    });
  }
};


