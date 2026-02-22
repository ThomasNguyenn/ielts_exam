import crypto from "crypto";
import cloudinary from "../utils/cloudinary.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || "";
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "alloy";
const OPENAI_TTS_SPEED = Number(process.env.OPENAI_TTS_SPEED || 1);
const OPENAI_TTS_TIMEOUT_MS = Number(process.env.OPENAI_TTS_TIMEOUT_MS || 45000);

const normalizeText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const safeSegment = (value = "") => String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "-");

const hashText = (value = "") =>
  crypto.createHash("sha256").update(normalizeText(value)).digest("hex").slice(0, 16);

const buildQuestionItems = (topic) => {
  const items = [];
  const promptText = normalizeText(topic?.prompt || "");
  if (promptText) {
    items.push({ key: "prompt", type: "prompt", index: 0, text: promptText });
  }

  const subQuestions = Array.isArray(topic?.sub_questions) ? topic.sub_questions : [];
  subQuestions.forEach((questionText, index) => {
    const text = normalizeText(questionText);
    if (!text) return;
    items.push({
      key: `sub-${index}`,
      type: "sub_question",
      index,
      text,
    });
  });

  return items;
};

const getStoredEntry = (readAloud, item) => {
  if (item.type === "prompt") return readAloud?.prompt || null;
  return (readAloud?.sub_questions || []).find((entry) => entry?.index === item.index) || null;
};

const requestOpenAiSpeechBuffer = async (text) => {
  if (!OPENAI_API_KEY) {
    const error = new Error("OpenAI API key is not configured");
    error.code = "OPENAI_TTS_KEY_MISSING";
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TTS_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice: OPENAI_TTS_VOICE,
        input: text,
        response_format: "mp3",
        speed: OPENAI_TTS_SPEED,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`OpenAI TTS failed (${response.status}): ${errorText.slice(0, 300)}`);
    }

    const bytes = await response.arrayBuffer();
    return Buffer.from(bytes);
  } finally {
    clearTimeout(timeout);
  }
};

const uploadSpeechToCloudinary = async ({ topicId, item, audioBuffer, textHash }) => {
  const dataUri = `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
  const publicId = `${safeSegment(topicId)}-${item.type}-${item.index}-${textHash}`;

  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder: "ielts-speaking-question-tts",
    public_id: publicId,
    overwrite: true,
    invalidate: true,
    resource_type: "video",
    use_filename: false,
    unique_filename: false,
  });

  return {
    url: uploaded.secure_url,
    public_id: uploaded.public_id,
    mime_type: "audio/mpeg",
    generated_at: new Date(),
  };
};

const buildConversationScript = (questionItems, resolvedAudioMap, keyAvailable) => ({
  mode: "part3_conversational",
  provider: "openai",
  model: OPENAI_TTS_MODEL,
  voice: OPENAI_TTS_VOICE,
  key_available: keyAvailable,
  questions: questionItems.map((item) => {
    const audio = resolvedAudioMap.get(item.key) || null;
    return {
      type: item.type,
      index: item.index,
      text: item.text,
      audio_url: audio?.url || null,
      audio_status: audio?.url ? "ready" : (keyAvailable ? "missing" : "unavailable"),
    };
  }),
});

export const ensurePart3ConversationScript = async (topicDocument, options = {}) => {
  const includeStats = Boolean(options.includeStats);
  const isPart3 = Number(topicDocument?.part) === 3;
  if (!isPart3) {
    return includeStats
      ? {
        script: null,
        stats: {
          totalItems: 0,
          generatedItemCount: 0,
          cacheHitItemCount: 0,
          missingItemCount: 0,
          updated: false,
        },
      }
      : null;
  }

  const questionItems = buildQuestionItems(topicDocument);
  const keyAvailable = Boolean(OPENAI_API_KEY);

  const existingReadAloud = topicDocument.read_aloud || {};
  const nextPromptEntry = {};
  const nextSubQuestionEntries = [];
  const resolvedAudioMap = new Map();
  let shouldSave = false;
  let generatedItemCount = 0;
  let cacheHitItemCount = 0;
  let missingItemCount = 0;

  for (const item of questionItems) {
    const textHash = hashText(item.text);
    const currentEntry = getStoredEntry(existingReadAloud, item);
    const isCacheHit =
      currentEntry &&
      String(currentEntry.text_hash || "") === textHash &&
      String(currentEntry.url || "").trim();

    let finalEntry = null;

    if (isCacheHit) {
      cacheHitItemCount += 1;
      finalEntry = {
        text_hash: textHash,
        url: currentEntry.url,
        public_id: currentEntry.public_id || null,
        mime_type: currentEntry.mime_type || "audio/mpeg",
        generated_at: currentEntry.generated_at || null,
      };
    } else if (keyAvailable) {
      const speechBuffer = await requestOpenAiSpeechBuffer(item.text);
      const uploaded = await uploadSpeechToCloudinary({
        topicId: topicDocument._id,
        item,
        audioBuffer: speechBuffer,
        textHash,
      });
      finalEntry = {
        text_hash: textHash,
        ...uploaded,
      };
      shouldSave = true;
      generatedItemCount += 1;
    } else {
      missingItemCount += 1;
      finalEntry = {
        text_hash: textHash,
        url: null,
        public_id: null,
        mime_type: null,
        generated_at: null,
      };
    }

    if (item.type === "prompt") {
      Object.assign(nextPromptEntry, finalEntry);
    } else {
      nextSubQuestionEntries.push({
        index: item.index,
        ...finalEntry,
      });
    }

    resolvedAudioMap.set(item.key, finalEntry);
  }

  const previousSubEntries = Array.isArray(existingReadAloud.sub_questions)
    ? existingReadAloud.sub_questions.length
    : 0;
  if (previousSubEntries !== nextSubQuestionEntries.length) {
    shouldSave = true;
  }

  let updated = false;
  if (shouldSave) {
    topicDocument.read_aloud = {
      provider: "openai",
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      prompt: nextPromptEntry,
      sub_questions: nextSubQuestionEntries,
      updated_at: new Date(),
    };
    await topicDocument.save();
    updated = true;
  }

  const script = buildConversationScript(questionItems, resolvedAudioMap, keyAvailable);
  if (!includeStats) return script;

  return {
    script,
    stats: {
      totalItems: questionItems.length,
      generatedItemCount,
      cacheHitItemCount,
      missingItemCount,
      updated,
    },
  };
};
