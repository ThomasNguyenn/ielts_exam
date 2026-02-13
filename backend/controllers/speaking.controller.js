import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Speaking from "../models/Speaking.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import { requestGeminiJsonWithFallback } from "../utils/aiClient.js";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODELS = [
  process.env.GEMINI_PRIMARY_MODEL || "gemini-2.0-flash",
  process.env.GEMINI_FALLBACK_MODEL || "gemini-1.5-flash",
];

const toAudioPart = async (filePath, mimeType) => {
  const fileBuffer = await fs.promises.readFile(filePath);
  return {
    inlineData: {
      data: fileBuffer.toString("base64"),
      mimeType,
    },
  };
};

const buildFallbackAnalysis = (clientTranscript) => ({
  transcript: clientTranscript || "Transcript unavailable",
  band_score: 0,
  fluency_coherence: { score: 0, feedback: "AI scoring temporarily unavailable." },
  lexical_resource: { score: 0, feedback: "AI scoring temporarily unavailable." },
  grammatical_range: { score: 0, feedback: "AI scoring temporarily unavailable." },
  pronunciation: { score: 0, feedback: "AI scoring temporarily unavailable." },
  general_feedback: "He thong tam thoi khong cham duoc bai noi. Bai nop van da duoc luu.",
  sample_answer: "N/A",
});

const buildStrictSpeakingPrompt = ({
  topicPrompt,
  clientWPM,
  parsedMetrics,
  clientTranscript,
}) => `
You are both:
1) A STRICT IELTS Speaking examiner (official IELTS descriptors), and
2) An ELSA-style pronunciation coach (segmentals + suprasegmentals).

TOPIC / QUESTION:
"${topicPrompt}"

SYSTEM METRICS:
- WPM: ${clientWPM}
- Pause count: ${parsedMetrics.pauseCount || 0}
- Total pause duration (ms): ${parsedMetrics.totalPauseDuration || 0}
- Longest pause (ms): ${parsedMetrics.longestPause || 0}
- Avg pause duration (ms): ${parsedMetrics.avgPauseDuration || 0}
- Client transcript: "${clientTranscript || "(none)"}"

CRITICAL RULES (STRICT SCORING):
- You MUST listen to the audio first. Transcript is secondary.
- If transcript conflicts with audio, trust the audio.
- Score exactly 4 IELTS criteria:
  Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation.
- Each criterion score must be 0.0 to 9.0 in 0.5 steps only.
- Overall band_score must be the average of 4 criteria, rounded to nearest 0.5.
- Do NOT be lenient. Do NOT inflate scores.
- If pronunciation causes frequent misunderstanding, pronunciation <= 5.5.
- If fluency has frequent long pauses and broken delivery, fluency_coherence <= 6.0.
- If grammar errors are frequent and reduce clarity, grammatical_range <= 5.5.
- If ideas are underdeveloped with short/simple answers, fluency_coherence <= 5.5.
- Do not award band >= 7.0 unless performance is consistently strong across all 4 criteria.

PRONUNCIATION MUST FOLLOW ELSA-STYLE ANALYSIS:
- Segmentals: vowel/consonant substitutions and unclear phonemes.
- Final endings: specifically check missing -s / -es / -ed / final consonants.
- Word stress errors.
- Sentence stress and thought-grouping.
- Intonation and rhythm (flat/unnatural patterns).
- Connected speech (linking/reduction) issues.

OUTPUT LANGUAGE:
- Feedback in Vietnamese.
- Keep examples concrete from the student's production.

RETURN ONLY VALID JSON (no markdown, no extra text):
{
  "transcript": "string (best ASR transcript from audio)",
  "band_score": number,
  "fluency_coherence": { "score": number, "feedback": "string" },
  "lexical_resource": { "score": number, "feedback": "string" },
  "grammatical_range": { "score": number, "feedback": "string" },
  "pronunciation": {
    "score": number,
    "feedback": "string with these sections: Âm nguyên âm, Âm cuối, Trọng âm, Ngữ điệu, Nhịp điệu, Kế hoạch hành động"
  },
  "general_feedback": "string (strict overall summary with top priority fixes)",
  "sample_answer": "string (Band 8.0+ model answer for this topic)"
}
`;

export const getRandomSpeaking = async (req, res) => {
  try {
    const count = await Speaking.countDocuments({ is_active: true });
    const random = Math.floor(Math.random() * count);
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
  try {
    const { questionId, transcript: clientTranscript, wpm, metrics } = req.body;
    const userId = req.user?.userId;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ message: "Audio file is required" });
    }

    const topic = await Speaking.findById(questionId);
    if (!topic) {
      return res.status(404).json({ message: "Speaking topic not found" });
    }

    let parsedMetrics = {};
    try {
      parsedMetrics = typeof metrics === "string" ? JSON.parse(metrics) : (metrics || {});
    } catch {
      parsedMetrics = {};
    }

    const clientWPM = wpm || 0;
    const prompt = buildStrictSpeakingPrompt({
      topicPrompt: topic.prompt,
      clientWPM,
      parsedMetrics,
      clientTranscript,
    });

    let analysisResult;
    let aiSource = "fallback";

    try {
      const audioPart = await toAudioPart(audioFile.path, audioFile.mimetype || "audio/webm");
      const aiResponse = await requestGeminiJsonWithFallback({
        genAI,
        models: GEMINI_MODELS,
        contents: [prompt, audioPart],
        generationConfig: { responseMimeType: "application/json" },
        timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 45000),
        maxAttempts: Number(process.env.GEMINI_MAX_ATTEMPTS || 3),
      });
      analysisResult = aiResponse.data;
      aiSource = aiResponse.model;
    } catch (aiError) {
      console.error("Speaking AI fallback triggered:", aiError.message);
      analysisResult = buildFallbackAnalysis(clientTranscript);
    }

    const session = new SpeakingSession({
      questionId,
      userId: userId || undefined,
      audioUrl: audioFile.path,
      transcript: analysisResult.transcript,
      analysis: analysisResult,
      metrics: {
        wpm: clientWPM,
        pauses: parsedMetrics,
      },
      status: "completed",
    });

    await session.save();

    return res.json({
      session_id: session._id,
      transcript: analysisResult.transcript,
      analysis: analysisResult,
      ai_source: aiSource,
    });
  } catch (error) {
    console.error("Speaking AI Error:", error);
    return res.status(500).json({ message: error.message });
  }
};
