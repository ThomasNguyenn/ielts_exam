import Speaking from "../models/Speaking.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import cloudinary from "../utils/cloudinary.js";
import { isAiAsyncModeEnabled } from "../config/queue.config.js";
import { enqueueSpeakingAiScoreJob, isAiQueueReady } from "../queues/ai.queue.js";
import { scoreSpeakingSessionById, generateMockExaminerFollowUp } from "../services/speakingGrading.service.js";
import { evaluateSpeakingProvisionalScore } from "../services/speakingFastScore.service.js";
import { ensurePart3ConversationScript, generatePromptReadAloudPreview } from "../services/speakingReadAloud.service.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";

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

const normalizeMockExaminerTurns = (turns = []) =>
  (Array.isArray(turns) ? turns : [])
    .filter((turn) => ["examiner", "candidate"].includes(String(turn?.role || "")))
    .map((turn) => ({
      role: String(turn.role).toLowerCase(),
      message: String(turn.message || "").trim(),
      createdAt: turn.createdAt || new Date(),
    }))
    .filter((turn) => turn.message)
    .slice(-20);

const MAX_CANDIDATE_ANSWER_CHARS = Number(process.env.SPEAKING_MOCK_MAX_ANSWER_CHARS || 2000);
const SPEAKING_FAST_SCORE_TIMEOUT_MS = Number(process.env.SPEAKING_FAST_SCORE_TIMEOUT_MS || 3500);

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

const pickSpeakingPayload = (body = {}, { allowId = false } = {}) => {
  const allowed = [
    "title",
    "part",
    "prompt",
    "sub_questions",
    "read_aloud",
    "keywords",
    "sample_highlights",
    "is_active",
  ];

  if (allowId) {
    allowed.push("_id");
  }

  return allowed.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      acc[field] = body[field];
    }
    return acc;
  }, {});
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
      return res.status(404).json({ success: false, message: "No speaking topics found" });
    }
    const random = Math.floor(Math.random() * count);
    const topic = await Speaking.findOne({ is_active: true }).skip(random);

    if (!topic) {
      return res.status(404).json({ success: false, message: "No speaking topics found" });
    }

    return res.json({ success: true, data: topic });
  } catch (error) {
    console.error("Get random speaking failed:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
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
        { prompt: safeRegex }
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
    console.error("Get speakings failed:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getSpeakingById = async (req, res) => {
  try {
    const topic = await Speaking.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ success: false, message: "Speaking topic not found" });
    }

    const conversationScript = await ensurePart3ConversationScript(topic);
    const payload = topic.toObject();
    if (conversationScript) {
      payload.conversation_script = conversationScript;
    }

    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error("Get speaking by id failed:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
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
    return res.status(500).json({ success: false, message: "Server Error" });
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
    if (statusCode >= 500) {
      console.error("Generate speaking prompt read-aloud failed:", error);
    }
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Server Error",
    });
  }
};

export const getSpeakingSession = async (req, res) => {
  try {
    const session = await SpeakingSession.findById(req.params.id).lean();
    if (!session) {
      return res.status(404).json({ success: false, message: "Speaking session not found" });
    }

    if (!canAccessSession(session, req.user)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    return res.json({
      success: true,
      data: {
        session_id: session._id,
        status: session.status,
        scoring_state: deriveScoringState(session),
        transcript: session.transcript || "",
        analysis: session.analysis || null,
        ai_source: session.ai_source || null,
        provisional_analysis: session.provisional_analysis || null,
        provisional_source: session.provisional_source || null,
        provisional_ready_at: session.provisional_ready_at || null,
        mock_examiner_turns: session.mockExaminerTurns || [],
        mock_examiner_meta: session.mockExaminerMeta || {
          ai_source: null,
          lastFeedback: "",
          finalAssessment: "",
          isCompleted: false,
          updatedAt: null,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const runMockExaminerTurn = async (req, res) => {
  try {
    const session = await SpeakingSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: "Speaking session not found" });
    }

    if (!canAccessSession(session, req.user)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const topic = await Speaking.findById(session.questionId).lean();
    if (!topic) {
      return res.status(404).json({ success: false, message: "Speaking topic not found" });
    }

    const userAnswerRaw = String(req.body?.userAnswer || "").trim();
    if (userAnswerRaw.length > MAX_CANDIDATE_ANSWER_CHARS) {
      return res.status(400).json({
        success: false,
        message: `Answer is too long. Maximum ${MAX_CANDIDATE_ANSWER_CHARS} characters.`,
      });
    }

    const turns = normalizeMockExaminerTurns(session.mockExaminerTurns || []);
    const hasConversationStarted = turns.length > 0;
    if (hasConversationStarted && !userAnswerRaw && !session.mockExaminerMeta?.isCompleted) {
      const latestExaminerTurn = [...turns].reverse().find((turn) => turn.role === "examiner");
      return res.json({
        success: true,
        data: {
          completed: false,
          turns,
          next_question: latestExaminerTurn?.message || "",
          pressure_feedback: session.mockExaminerMeta?.lastFeedback || "",
          final_assessment: session.mockExaminerMeta?.finalAssessment || "",
          ai_source: session.mockExaminerMeta?.ai_source || null,
        },
      });
    }

    if (session.mockExaminerMeta?.isCompleted) {
      return res.json({
        success: true,
        data: {
          completed: true,
          turns,
          next_question: "",
          pressure_feedback: session.mockExaminerMeta?.lastFeedback || "",
          final_assessment: session.mockExaminerMeta?.finalAssessment || "",
          ai_source: session.mockExaminerMeta?.ai_source || null,
        },
      });
    }

    const updatedTurns = [...turns];
    if (userAnswerRaw) {
      updatedTurns.push({
        role: "candidate",
        message: userAnswerRaw,
        createdAt: new Date(),
      });
    }

    const followUp = await generateMockExaminerFollowUp({
      topicPrompt: topic.prompt,
      topicPart: topic.part || 3,
      subQuestions: topic.sub_questions || [],
      transcript: session.transcript || "",
      turns: updatedTurns,
      latestAnswer: userAnswerRaw,
    });

    if (!followUp.shouldEnd && followUp.nextQuestion) {
      updatedTurns.push({
        role: "examiner",
        message: followUp.nextQuestion,
        createdAt: new Date(),
      });
    }

    session.mockExaminerTurns = updatedTurns;
    session.mockExaminerMeta = {
      ai_source: followUp.aiSource || null,
      lastFeedback: followUp.pressureFeedback || "",
      finalAssessment: followUp.finalAssessment || "",
      isCompleted: Boolean(followUp.shouldEnd),
      updatedAt: new Date(),
    };
    await session.save();

    return res.json({
      success: true,
      data: {
        completed: Boolean(followUp.shouldEnd),
        turns: session.mockExaminerTurns,
        next_question: followUp.nextQuestion || "",
        pressure_feedback: followUp.pressureFeedback || "",
        final_assessment: followUp.finalAssessment || "",
        ai_source: followUp.aiSource || null,
      },
    });
  } catch (error) {
    console.error("Mock examiner turn failed:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const createSpeaking = async (req, res) => {
  try {
    const payload = pickSpeakingPayload(req.body, { allowId: true });
    const newTopic = new Speaking(payload);
    const savedTopic = await newTopic.save();
    return res.status(201).json({ success: true, data: savedTopic });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateSpeaking = async (req, res) => {
  try {
    const payload = pickSpeakingPayload(req.body);
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ success: false, message: "No valid update fields provided" });
    }

    const updatedTopic = await Speaking.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true },
    );
    if (!updatedTopic) {
      return res.status(404).json({ success: false, message: "Speaking topic not found" });
    }
    return res.json({ success: true, data: updatedTopic });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteSpeaking = async (req, res) => {
  try {
    const topic = await Speaking.findByIdAndDelete(req.params.id);
    if (!topic) {
      return res.status(404).json({ success: false, message: "Speaking topic not found" });
    }
    return res.json({ success: true, message: "Speaking topic deleted successfully" });
  } catch (error) {
    console.error("Delete speaking failed:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const submitSpeaking = async (req, res) => {
  let session = null;
  try {
    const { questionId, transcript: clientTranscript = "", wpm, metrics } = req.body;
    const userId = req.user?.userId;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ message: "Audio file is required" });
    }

    const topic = await Speaking.findById(questionId).select("_id");
    if (!topic) {
      return res.status(404).json({ message: "Speaking topic not found" });
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
        if (!session.transcript && fastScoreResult.transcript) {
          session.transcript = fastScoreResult.transcript;
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

    const shouldQueue = isAiAsyncModeEnabled() && isAiQueueReady();
    const canUseAsyncQueue = shouldQueue && Boolean(userId);

    if (shouldQueue && !userId) {
      console.warn("Speaking async queue skipped: missing authenticated user, falling back to sync scoring");
    }

    if (canUseAsyncQueue) {
      try {
        const queueResult = await enqueueSpeakingAiScoreJob({ sessionId: String(session._id) });
        if (queueResult.queued) {
          return res.status(202).json({
            success: true,
            session_id: session._id,
            status: "processing",
            scoring_state: deriveScoringState(session),
            queued: true,
            job_id: queueResult.jobId,
            provisional_analysis: session.provisional_analysis || null,
            provisional_source: session.provisional_source || null,
            provisional_ready_at: session.provisional_ready_at || null,
            xpResult,
            achievements: newlyUnlocked
          });
        }
      } catch (queueError) {
        console.warn("Speaking enqueue failed, falling back to sync scoring:", queueError.message);
      }
    }

    const grading = await scoreSpeakingSessionById({ sessionId: String(session._id), force: true });
    return res.json({
      success: true,
      session_id: grading.session._id,
      status: grading.session.status,
      scoring_state: deriveScoringState(grading.session),
      transcript: grading.analysis?.transcript || "",
      analysis: grading.analysis || null,
      ai_source: grading.aiSource,
      provisional_analysis: grading.session?.provisional_analysis || null,
      provisional_source: grading.session?.provisional_source || null,
      provisional_ready_at: grading.session?.provisional_ready_at || null,
      queued: false,
      xpResult,
      achievements: newlyUnlocked
    });
  } catch (error) {
    if (session?._id) {
      await SpeakingSession.findByIdAndUpdate(session._id, { status: "failed", scoring_state: "failed" }).catch(() => { });
    }
    console.error("Speaking submission failed:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
