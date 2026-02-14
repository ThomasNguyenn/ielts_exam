import Speaking from "../models/Speaking.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import cloudinary from "../utils/cloudinary.js";
import { isAiAsyncModeEnabled } from "../config/queue.config.js";
import { enqueueSpeakingAiScoreJob, isAiQueueReady } from "../queues/ai.queue.js";
import { scoreSpeakingSessionById } from "../services/speakingGrading.service.js";
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

const uploadSpeakingAudio = async (audioFile) => {
  if (!audioFile?.buffer) {
    throw new Error("Audio buffer is missing");
  }

  const b64 = Buffer.from(audioFile.buffer).toString("base64");
  const dataURI = `data:${audioFile.mimetype || "audio/webm"};base64,${b64}`;

  const result = await cloudinary.uploader.upload(dataURI, {
    folder: "ielts-speaking-recordings",
    resource_type: "video",
    use_filename: false,
    unique_filename: true,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

export const getRandomSpeaking = async (req, res) => {
  try {
    const count = await Speaking.countDocuments({ is_active: true });
    const random = Math.floor(Math.random() * Math.max(count, 1));
    const topic = await Speaking.findOne({ is_active: true }).skip(random);

    if (!topic) {
      return res.status(404).json({ message: "No speaking topics found" });
    }

    return res.json(topic);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getSpeakings = async (req, res) => {
  try {
    const isTopicsOnly = String(req.query.topicsOnly || '').toLowerCase() === 'true';

    if (isTopicsOnly) {
      try {
        const topics = await Speaking.distinct('title', { is_active: true });
        return res.json({ success: true, topics: normalizeTopicList(topics) });
      } catch (distinctError) {
        console.error(
          `[getSpeakings][topicsOnly][distinct] requestId=${req.requestId || "n/a"} failed:`,
          distinctError?.message || distinctError
        );

        // Fallback query in case distinct fails due data/index inconsistencies.
        const docs = await Speaking.find({ is_active: true }).select({ title: 1, _id: 0 }).lean();
        const fallbackTopics = docs.map((doc) => doc?.title);
        return res.json({ success: true, topics: normalizeTopicList(fallbackTopics) });
      }
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
    return res.status(500).json({ message: error.message });
  }
};

export const getSpeakingById = async (req, res) => {
  try {
    const topic = await Speaking.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ message: "Speaking topic not found" });
    }
    return res.json(topic);
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
        transcript: session.transcript || "",
        analysis: session.analysis || null,
        ai_source: session.ai_source || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createSpeaking = async (req, res) => {
  try {
    const newTopic = new Speaking(req.body);
    const savedTopic = await newTopic.save();
    return res.status(201).json(savedTopic);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const updateSpeaking = async (req, res) => {
  try {
    const updatedTopic = await Speaking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    if (!updatedTopic) {
      return res.status(404).json({ message: "Speaking topic not found" });
    }
    return res.json(updatedTopic);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const deleteSpeaking = async (req, res) => {
  try {
    const topic = await Speaking.findByIdAndDelete(req.params.id);
    if (!topic) {
      return res.status(404).json({ message: "Speaking topic not found" });
    }
    return res.json({ message: "Speaking topic deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
            queued: true,
            job_id: queueResult.jobId,
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
      transcript: grading.analysis?.transcript || "",
      analysis: grading.analysis || null,
      ai_source: grading.aiSource,
      queued: false,
    });
  } catch (error) {
    if (session?._id) {
      await SpeakingSession.findByIdAndUpdate(session._id, { status: "failed" }).catch(() => {});
    }
    console.error("Speaking submission failed:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
