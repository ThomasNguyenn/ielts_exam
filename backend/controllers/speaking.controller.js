import Speaking from "../models/Speaking.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import cloudinary from "../utils/cloudinary.js";
import { isAiAsyncModeEnabled } from "../config/queue.config.js";
import { enqueueSpeakingAiScoreJob, isAiQueueReady } from "../queues/ai.queue.js";
import { scoreSpeakingSessionById } from "../services/speakingGrading.service.js";

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
    const topics = await Speaking.find({ is_active: true }).sort({ created_at: -1 });
    return res.json({ success: true, data: topics });
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
    if (shouldQueue) {
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
