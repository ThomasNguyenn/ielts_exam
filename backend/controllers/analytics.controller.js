import TestAttempt from "../models/TestAttempt.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import Test from "../models/Test.model.js";
import mongoose from "mongoose";
import OpenAI from "openai";
import dotenv from "dotenv";
import { getErrorCodeMeta, normalizeErrorCode } from "../services/taxonomy.registry.js";
import { getJson, setJson } from "../services/responseCache.redis.js";
import {
  average,
  buildAnalyticsHistoryRaw,
  buildAnalyticsProgressHistory,
  buildAnalyticsSummary,
  parseObjectiveAttempt,
  roundHalf,
  roundOne,
  toBandScore,
} from "../services/analyticsKpi.service.js";
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ANALYTICS_SKILLS = new Set(["reading", "listening", "writing", "speaking"]);
const ANALYTICS_RANGE_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};
const AI_INSIGHTS_CACHE_TTL_SEC = Math.max(
  1,
  Number.parseInt(process.env.API_RESPONSE_CACHE_TTL_ANALYTICS_INSIGHTS_SEC || "1800", 10) || 1800,
);
const AI_INSIGHTS_CACHE_KEY_PREFIX = "analytics:ai-insights:";

const CATEGORY_LABELS_VI = Object.freeze({
  FORM: "Lỗi hình thức",
  LEXICAL: "Lỗi từ vựng",
  INFERENCE: "Lỗi suy luận",
  DISCOURSE: "Lỗi diễn ngôn",
  STRATEGY: "Lỗi chiến lược",
  ATTENTION: "Lỗi tập trung",
  MEMORY: "Lỗi bộ nhớ",
  TASK: "Lỗi đáp ứng đề bài",
  COHESION: "Lỗi liên kết",
  GRAMMAR: "Lỗi ngữ pháp",
  FLUENCY: "Lỗi độ trôi chảy",
  COHERENCE: "Lỗi mạch lạc",
  PRONUNCIATION: "Lỗi phát âm",
  "Z. Unclassified": "Chưa phân loại",
  "Legacy (Deprecated)": "Mã cũ (đã ngưng dùng)",
});

const COGNITIVE_LABELS_VI = Object.freeze({
  Retrieval: "Truy xuất thông tin",
  "Semantic Mapping": "Ánh xạ ngữ nghĩa",
  Inference: "Suy luận",
  "Discourse Tracking": "Theo dõi diễn ngôn",
  "Scope Monitoring": "Kiểm soát phạm vi",
  "Exec Control": "Kiểm soát điều hành",
  Acoustic: "Phân biệt âm thanh",
  Segmentation: "Phân tách đơn vị nghe",
  Prediction: "Dự đoán",
  Attention: "Tập trung chú ý",
  "Working Memory": "Bộ nhớ làm việc",
  "Idea Generation": "Tạo ý tưởng",
  Planning: "Lập ý",
  "Lexical Retrieval": "Truy xuất từ vựng",
  "Syntax Construction": "Xây dựng cấu trúc câu",
  "Monitoring Revision": "Giám sát và chỉnh sửa",
  "Real-time Planning": "Lập ý thời gian thực",
  "Lexical Access": "Truy cập từ vựng",
  "Grammatical Encoding": "Mã hóa ngữ pháp",
  "Phonological Encoding": "Mã hóa âm vị",
  Monitoring: "Tự giám sát",
  General: "Tổng quát",
  "R1. Literal Comprehension": "Hiểu thông tin trực tiếp",
  "R2. Paraphrase Recognition": "Nhận diện diễn đạt lại",
  "R3. Inference": "Suy luận",
  "R4. Logical Relationship": "Quan hệ logic",
  "R5. Skimming / Scanning": "Đọc lướt và quét thông tin",
  "L1. Sound Discrimination": "Phân biệt âm",
  "L2. Word Boundary Detection": "Nhận diện ranh giới từ",
  "L3. Connected Speech Recognition": "Nhận diện nối âm",
  "L4. Number & Spelling Accuracy": "Độ chính xác số và chính tả",
  "L5. Attention Tracking": "Theo dõi chú ý",
  "W-TR. Task Response / Achievement": "Đáp ứng yêu cầu đề bài",
  "W-CC. Coherence & Cohesion": "Mạch lạc và liên kết",
  "W-LR. Lexical Resource": "Nguồn từ vựng",
  "W-GRA. Grammatical Range & Accuracy": "Độ phong phú và chính xác ngữ pháp",
  "S-FC. Fluency & Coherence": "Độ trôi chảy và mạch lạc",
  "S-LR. Lexical Resource": "Nguồn từ vựng",
  "S-GRA. Grammatical Range & Accuracy": "Độ phong phú và chính xác ngữ pháp",
  "S-PR. Pronunciation": "Phát âm",
});

const DIMENSION_LABELS_VI = Object.freeze({
  "R.A.EXPLICIT": "Thông tin hiển ngôn",
  "R.A.INFERENCE": "Ý nghĩa hàm ẩn",
  "R.A.WRITER_VIEW": "Quan điểm tác giả",
  "R.A.LOGIC": "Theo dõi lập luận",
  "R.A.MAIN_IDEA": "Ý chính và chức năng đoạn",
  "R.A.PARAPHRASE": "Ánh xạ diễn đạt lại",
  "R.A.FORM": "Tuân thủ hình thức",
  "R.A.TIME_STRATEGY": "Quản lý thời gian và chiến lược",
  "L.A.PHONO_LEXICAL": "Nhận diện âm-thành từ vựng",
  "L.A.CONNECTED_SPEECH": "Giải mã nối âm",
  "L.A.DISTRACTOR": "Xử lý thông tin gây nhiễu",
  "L.A.FORM": "Tuân thủ hình thức",
  "L.A.PREDICTIVE": "Nghe dự đoán",
  "L.A.WORKING_MEMORY": "Bộ nhớ làm việc",
  "W.A.TASK_RESPONSE": "Đáp ứng đề bài",
  "W.A.COHERENCE": "Mạch lạc và liên kết",
  "W.A.LEXICAL": "Nguồn từ vựng",
  "W.A.GRAMMAR": "Ngữ pháp",
  "S.A.FLUENCY_COHERENCE": "Độ trôi chảy và mạch lạc",
  "S.A.LEXICAL": "Nguồn từ vựng",
  "S.A.GRAMMAR": "Ngữ pháp",
  "S.A.PRONUNCIATION": "Phát âm",
  unclassified: "Chưa phân loại",
  deprecated_legacy: "Mã cũ (đã ngưng dùng)",
});

const SUBTYPE_OVERRIDES_VI = Object.freeze({
  SPELLING: "Lỗi chính tả",
  PLURAL_S: "Sai số ít/số nhiều",
  WORD_FORM: "Sai dạng từ",
  NUMBER_FORMAT: "Sai định dạng số",
  PROPER_NOUN_FORMAT: "Sai danh từ riêng",
  WORD_LIMIT: "Vượt giới hạn số từ",
  INCOMPLETE_ANSWER: "Bỏ trống câu trả lời",
  PARAPHRASE_MISS: "Bỏ lỡ paraphrase",
  NEGATION_TRAP: "Bẫy phủ định",
  QUANTIFIER_SCOPE: "Sai phạm vi từ chỉ lượng",
  WRITER_ATTITUDE: "Nhận diện sai thái độ tác giả",
  WRITING_MISSING_OVERVIEW: "Thiếu overview",
  WRITING_KEY_FEATURE_SELECTION: "Chọn sai đặc điểm chính",
  WRITING_INSUFFICIENT_DEVELOPMENT: "Phát triển ý chưa đủ",
  WRITING_WORD_CHOICE: "Chọn từ chưa chính xác",
  SPEAKING_FLUENCY_BREAKDOWN: "Gián đoạn độ trôi chảy",
  SPEAKING_LEX_RANGE_LIMITED: "Vốn từ hạn chế",
  SPEAKING_PRON_INTELLIGIBILITY: "Độ rõ tiếng phát âm thấp",
  MCQ_INFERENCE_EXPLICIT: "Suy luận từ thông tin hiển ngôn (trắc nghiệm)",
  SPEAKING_PRON_VOWEL_CONSONANT: "Lỗi phát âm nguyên âm/phụ âm",
  CROSS_SENTENCE_LINK_FAIL: "Lỗi liên kết giữa các câu",
  REFERENCE_CHAIN_MISS: "Bỏ sót chuỗi tham chiếu",
});

const TOKEN_VI = Object.freeze({
  MCQ: "trắc nghiệm",
  INFERENCE: "suy luận",
  EXPLICIT: "hiển ngôn",
  TFNG: "true/false/not given",
  YNNG: "yes/no/not given",
  SPELL: "chính tả",
  SPELLING: "chính tả",
  PLUR: "số ít-số nhiều",
  WFORM: "dạng từ",
  WORD: "từ",
  FORM: "hình thức",
  NUM: "số",
  NUMBER: "số",
  PN: "danh từ riêng",
  WLIM: "giới hạn số từ",
  OMIT: "bỏ trống",
  KEY: "từ khóa",
  SCOPE: "phạm vi",
  DIST: "gây nhiễu",
  DISTRACTOR: "gây nhiễu",
  NEG: "phủ định",
  PART: "một phần",
  OVER: "quá mức",
  QNT: "chỉ lượng",
  OPF: "ý kiến-và-sự thật",
  PARA: "paraphrase",
  STEM: "yêu cầu câu hỏi",
  TIME: "trình tự thời gian",
  QUAL: "từ hạn định",
  EXT: "từ cực đoan",
  NGF: "not given va false/no",
  MID: "ý chính-và-chi tiết",
  PFN: "chức năng đoạn",
  SIG: "tín hiệu liên kết",
  BND: "ranh giới đoạn",
  ENT: "thực thể-thuộc tính",
  PRO: "tham chiếu đại từ",
  TYPE: "loại nhãn",
  SPAT: "quan hệ không gian",
  LAND: "mốc địa điểm",
  ORI: "định hướng bản đồ",
  ROUTE: "tuyến đường",
  SEQ: "thứ tự bước",
  VIEW: "đổi góc nhìn",
  PREP: "giới từ vị trí",
  LINK: "liên kết",
  LINKO: "lạm dụng từ nối",
  LINKM: "nối câu máy móc",
  PARA_BLOCK: "đoạn văn",
  PROG: "tiến trình ý",
  RNG: "độ phong phú",
  CMPX: "cấu trúc phức",
  SVA: "hòa hợp chủ vị",
  TENSE: "thì",
  TEN: "thì",
  AP: "mạo từ và giới từ",
  CL: "ranh giới mệnh đề",
  INTEL: "độ rõ tiếng",
  PRON: "phát âm",
  VOWEL: "nguyên âm",
  CONSONANT: "phụ âm",
  SPEAKING: "nói",
  WST: "nhấn âm từ",
  SST: "nhấn âm câu",
  RHY: "nhịp điệu",
  CS: "nối âm",
  INTN: "ngữ điệu",
  VC: "nguyên âm-phụ âm",
  CHUNK: "ngắt cụm từ",
});

const humanizeTokenizedLabel = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  const normalizedSubtypeKey = normalized
    .replace(/[.\-/]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  if (SUBTYPE_OVERRIDES_VI[normalizedSubtypeKey]) return SUBTYPE_OVERRIDES_VI[normalizedSubtypeKey];
  if (SUBTYPE_OVERRIDES_VI[normalized]) return SUBTYPE_OVERRIDES_VI[normalized];
  if (CATEGORY_LABELS_VI[normalized]) return CATEGORY_LABELS_VI[normalized];
  if (COGNITIVE_LABELS_VI[normalized]) return COGNITIVE_LABELS_VI[normalized];
  if (DIMENSION_LABELS_VI[normalized]) return DIMENSION_LABELS_VI[normalized];

  const compact = normalized
    .replace(/[.\-/]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!compact) return normalized;
  const tokens = compact
    .split("_")
    .filter(Boolean)
    .map((token) => TOKEN_VI[token.toUpperCase()] || token.toLowerCase());

  return tokens.join(" ");
};

const translateCategoryToVi = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return CATEGORY_LABELS_VI[normalized] || humanizeTokenizedLabel(normalized);
};

const translateCognitiveSkillToVi = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return COGNITIVE_LABELS_VI[normalized] || humanizeTokenizedLabel(normalized);
};

const translateDimensionToVi = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return DIMENSION_LABELS_VI[normalized] || humanizeTokenizedLabel(normalized);
};

const resolveTaxonomyDisplay = (log = {}) => {
  const normalizedCode = normalizeErrorCode(log?.error_code || "");
  const meta = getErrorCodeMeta(normalizedCode);

  const rawLabel = String(log?.error_label || meta?.label || "").trim();
  const rawCategory = String(log?.error_category || meta?.category || "").trim();
  const rawCognitive = String(log?.cognitive_skill || meta?.cognitiveSkill || "").trim();
  const rawDimension = String(log?.taxonomy_dimension || meta?.dimension || "").trim();

  return {
    code: normalizedCode || "",
    meta,
    errorLabel: humanizeTokenizedLabel(rawLabel),
    errorCategory: translateCategoryToVi(rawCategory),
    cognitiveSkill: translateCognitiveSkillToVi(rawCognitive),
    taxonomyDimension: translateDimensionToVi(rawDimension),
  };
};

const parseAnalyticsFilters = (query = {}) => {
  const rawRange = String(query.range || "all").toLowerCase();
  const days = ANALYTICS_RANGE_DAYS[rawRange] || null;
  const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  const rawSkill = String(query.skill || query.skills || "all").toLowerCase();
  const parsedSkills = rawSkill
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => ANALYTICS_SKILLS.has(item));
  const skills = parsedSkills.length ? new Set(parsedSkills) : null;

  return {
    range: days ? rawRange : "all",
    skill: skills ? [...skills].sort().join(",") : "all",
    since,
    skills,
  };
};

const toInsightsCacheKey = (key) =>
  `${AI_INSIGHTS_CACHE_KEY_PREFIX}${String(key || "").trim()}`;

const buildHeuristicInsightsPayload = (errorLogs = [], filters = {}) => {
  const frequencies = {};
  errorLogs.forEach((log) => {
    const code = String(log?.error_code || "UNCLASSIFIED").toUpperCase();
    frequencies[code] = (frequencies[code] || 0) + 1;
  });

  const topCodes = Object.entries(frequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, count]) => `${code} (${count})`);

  return {
    no_data: false,
    feedback: null,
    overview: topCodes.length > 0
      ? `He thong tam thoi dung goi y co san. Loi xuat hien nhieu: ${topCodes.join(", ")}.`
      : "He thong tam thoi dung goi y co san.",
    actionable_advice: [
      "Tap trung sua cac loi lap lai nhieu nhat truoc.",
      "Luyen theo tung tieu chi va doi chieu dap an mau.",
    ],
    recommended_practice: [
      "Lam them bai cung dang cau hoi ban hay sai.",
      "Sau moi bai, tong hop 3 loi can tranh lap lai.",
    ],
    encouragement: "Tien do van duoc cap nhat, ban tiep tuc luyen tap de cai thien nhanh.",
    filters: {
      range: filters.range,
      skill: filters.skill,
    },
  };
};

const filterErrorLogs = (errorLogs = [], filters = {}) => {
  const { since, skills } = filters;
  return errorLogs.filter((log) => {
    if (skills && !skills.has(String(log?.skill || "").toLowerCase())) return false;
    if (since) {
      const loggedAt = new Date(log?.logged_at);
      if (Number.isNaN(loggedAt.getTime()) || loggedAt < since) return false;
    }
    return true;
  });
};

const toSafeErrorLogArray = (value) =>
  (Array.isArray(value) ? value : []).filter((item) => item && typeof item === "object");

const parseDetailsPagination = (query = {}) => {
  const parsedPage = Number(query.page);
  const parsedLimit = Number(query.limit);

  const page = Number.isFinite(parsedPage) && parsedPage > 0
    ? Math.floor(parsedPage)
    : 1;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(100, Math.max(5, Math.floor(parsedLimit)))
    : 20;

  return { page, limit };
};

const buildTaxonomyReason = (log = {}) => {
  const display = resolveTaxonomyDisplay(log);
  const parts = [
    display.code ? `Mã lỗi: ${display.code}` : null,
    display.errorLabel ? `Loại lỗi: ${display.errorLabel}` : null,
    display.errorCategory ? `Nhóm lỗi: ${display.errorCategory}` : null,
    display.cognitiveSkill ? `Kỹ năng nhận thức: ${display.cognitiveSkill}` : null,
    display.taxonomyDimension ? `Chiều đánh giá: ${display.taxonomyDimension}` : null,
  ].filter(Boolean);

  if (parts.length === 0) return "Không đủ dữ liệu để giải thích phân loại taxonomy.";
  return `${parts.join(" | ")}.`;
};

const getErrorLabel = (log = {}) => {
  const display = resolveTaxonomyDisplay(log);
  return display.errorLabel || "";
};

const normalizeErrorDetailsFilters = (query = {}) => ({
  errorCode: String(query.errorCode || query.code || "").trim().toUpperCase(),
  taskType: String(query.taskType || "").trim().toLowerCase(),
});

const normalizeTaskTypeForDetails = (rawType = "") => {
  const normalized = String(rawType || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) return "";

  const aliasMap = {
    true_false_notgiven: "true_false_not_given",
    tfng: "true_false_not_given",
    yes_no_notgiven: "yes_no_not_given",
    ynng: "yes_no_not_given",
    matching_info: "matching_information",
    flowchart_completion: "flow_chart_completion",
    mult_choice: "multiple_choice",
    multiple_choice_single: "multiple_choice",
    multiple_choice_multi: "multiple_choice",
    mult_choice_multi: "multiple_choice",
  };

  return aliasMap[normalized] || normalized;
};

const MAX_DETAIL_SNIPPET_LENGTH = 500;

const compactDetailText = (value = "", maxLength = MAX_DETAIL_SNIPPET_LENGTH) => {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
};

const formatQuestionOptionText = (option = {}) => {
  const label = compactDetailText(option?.label || "", 24);
  const text = compactDetailText(option?.text || "", 200);
  if (label && text) return `${label}. ${text}`;
  return label || text || "";
};

const resolveQuestionSnippetFromTest = (question = {}, group = {}) => {
  const direct = [
    question?.text,
    question?.question_text,
    group?.instructions,
    group?.text,
  ];

  for (const candidate of direct) {
    const normalized = compactDetailText(candidate);
    if (normalized) return normalized;
  }

  const questionOptions = Array.isArray(question?.option) ? question.option : [];
  const groupOptions = Array.isArray(group?.options) ? group.options : [];
  const options = (questionOptions.length ? questionOptions : groupOptions)
    .map((option) => formatQuestionOptionText(option))
    .filter(Boolean);

  if (options.length > 0) {
    return compactDetailText(`Lua chon: ${options.slice(0, 4).join(" | ")}`);
  }

  return "";
};

const buildQuestionSnippetLookupForTest = (testDoc = {}) => {
  const lookup = new Map();
  const items = [
    ...(Array.isArray(testDoc?.reading_passages) ? testDoc.reading_passages : []),
    ...(Array.isArray(testDoc?.listening_sections) ? testDoc.listening_sections : []),
  ];

  items.forEach((item) => {
    const groups = Array.isArray(item?.question_groups) ? item.question_groups : [];
    groups.forEach((group) => {
      const questions = Array.isArray(group?.questions) ? group.questions : [];
      questions.forEach((question) => {
        const questionNumber = Number(question?.q_number);
        if (!Number.isFinite(questionNumber)) return;

        const key = String(questionNumber);
        if (lookup.has(key)) return;

        const snippet = resolveQuestionSnippetFromTest(question, group);
        if (!snippet) return;
        lookup.set(key, snippet);
      });
    });
  });

  return lookup;
};

const buildAttemptQuestionSnippetLookup = async (attempts = []) => {
  const testIds = [...new Set(
    attempts
      .map((attempt) => String(attempt?.test_id || "").trim())
      .filter(Boolean),
  )];

  if (testIds.length === 0) return new Map();

  let tests = [];
  try {
    tests = await Test.find({ _id: { $in: testIds } })
      .populate("reading_passages")
      .populate("listening_sections")
      .select("_id reading_passages listening_sections")
      .lean();
  } catch (error) {
    console.warn("[analytics] Failed to build question snippet lookup:", error?.message || "Unknown error");
    return new Map();
  }

  const byTestId = new Map();
  tests.forEach((testDoc) => {
    byTestId.set(String(testDoc._id), buildQuestionSnippetLookupForTest(testDoc));
  });
  return byTestId;
};

const resolveDetailTextSnippet = (log = {}, fallbackSnippet = "") => {
  const candidates = [
    log?.text_snippet,
    log?.question_text,
    log?.question_prompt,
    fallbackSnippet,
  ];

  for (const candidate of candidates) {
    const normalized = compactDetailText(candidate);
    if (normalized) return normalized;
  }

  return "";
};

const filterErrorDetails = (details = [], query = {}) => {
  const { errorCode, taskType: rawTaskType } = normalizeErrorDetailsFilters(query);
  const taskType = normalizeTaskTypeForDetails(rawTaskType);
  if (!errorCode && !taskType) return details;

  return details.filter((item) => {
    const codeOk = !errorCode || String(item?.error_code || "").toUpperCase() === errorCode;
    const itemTaskType = normalizeTaskTypeForDetails(item?.task_type || "");
    const taskTypeOk = !taskType || itemTaskType === taskType;
    return codeOk && taskTypeOk;
  });
};

/**
 * Helper to fetch and merge all error logs for a specific user across R, L, W, S
 */
async function aggregateUserErrors(userId) {
  const errorLogs = [];

  // Reading & Listening
  const attempts = await TestAttempt.find({ user_id: userId, "error_logs.0": { $exists: true } })
    .sort({ submitted_at: -1 })
    .select("type error_logs submitted_at")
    .lean();
  attempts.forEach((a) => {
    toSafeErrorLogArray(a?.error_logs).forEach((log) => {
      errorLogs.push({ ...log, skill: a?.type, logged_at: a?.submitted_at });
    });
  });

  // Writing
  const writings = await WritingSubmission.find({ user_id: userId, "error_logs.0": { $exists: true } })
    .sort({ submitted_at: -1, createdAt: -1 })
    .select("error_logs submitted_at createdAt")
    .lean();
  writings.forEach((w) => {
    const loggedAt = w?.submitted_at || w?.createdAt;
    toSafeErrorLogArray(w?.error_logs).forEach((log) => {
      errorLogs.push({ ...log, skill: "writing", logged_at: loggedAt });
    });
  });

  // Speaking
  const speakings = await SpeakingSession.find({ userId: userId, "error_logs.0": { $exists: true } })
    .sort({ timestamp: -1, createdAt: -1 })
    .select("error_logs timestamp createdAt")
    .lean();
  speakings.forEach((s) => {
    const loggedAt = s?.timestamp || s?.createdAt;
    toSafeErrorLogArray(s?.error_logs).forEach((log) => {
      errorLogs.push({ ...log, skill: "speaking", logged_at: loggedAt });
    });
  });

  return errorLogs;
}

async function aggregateUserErrorDetails(userId) {
  const details = [];

  const attempts = await TestAttempt.find({ user_id: userId, "error_logs.0": { $exists: true } })
    .sort({ submitted_at: -1 })
    .select("_id type test_id submitted_at error_logs")
    .lean();
  const questionSnippetByTestId = await buildAttemptQuestionSnippetLookup(attempts);
  attempts.forEach((attemptDoc) => {
    const testId = String(attemptDoc.test_id || "").trim();
    const questionSnippetLookup = testId ? questionSnippetByTestId.get(testId) : null;

    toSafeErrorLogArray(attemptDoc?.error_logs).forEach((log, index) => {
      const taxonomyDisplay = resolveTaxonomyDisplay(log);
      const fallbackSnippet = questionSnippetLookup?.get(String(log.question_number || "")) || "";

      details.push({
        id: `attempt:${attemptDoc._id}:${index}`,
        source_type: "test_attempt",
        source_id: String(attemptDoc._id),
        source_label: "Lan lam bai",
        source_ref: attemptDoc.test_id || null,
        skill: attemptDoc.type || "unknown",
        logged_at: attemptDoc.submitted_at,
        task_type: log.task_type || "unknown",
        task_type_label: formatQuestionType(log.task_type || "unknown"),
        question_number: log.question_number || null,
        error_code: log.error_code || "UNCLASSIFIED",
        error_label: getErrorLabel(log),
        error_category: taxonomyDisplay.errorCategory || "",
        cognitive_skill: taxonomyDisplay.cognitiveSkill || "",
        taxonomy_dimension: taxonomyDisplay.taxonomyDimension || "",
        detection_method: log.detection_method || "",
        taxonomy_version: log.taxonomy_version || "",
        confidence: Number.isFinite(Number(log.confidence)) ? Number(log.confidence) : null,
        text_snippet: resolveDetailTextSnippet(log, fallbackSnippet),
        user_answer: log.user_answer || "",
        correct_answer: log.correct_answer || "",
        explanation: log.explanation || "",
        taxonomy_reason: buildTaxonomyReason(log),
      });
    });
  });

  const writings = await WritingSubmission.find({ user_id: userId, "error_logs.0": { $exists: true } })
    .sort({ submitted_at: -1, createdAt: -1 })
    .select("_id test_id submitted_at createdAt error_logs")
    .lean();
  writings.forEach((writingDoc) => {
    const loggedAt = writingDoc.submitted_at || writingDoc.createdAt;
    toSafeErrorLogArray(writingDoc?.error_logs).forEach((log, index) => {
      const taxonomyDisplay = resolveTaxonomyDisplay(log);
      details.push({
        id: `writing:${writingDoc._id}:${index}`,
        source_type: "writing_submission",
        source_id: String(writingDoc._id),
        source_label: "Bai viet",
        source_ref: writingDoc.test_id || null,
        skill: "writing",
        logged_at: loggedAt,
        task_type: log.task_type || "unknown",
        task_type_label: formatQuestionType(log.task_type || "unknown"),
        question_number: log.question_number || null,
        error_code: log.error_code || "UNCLASSIFIED",
        error_label: getErrorLabel(log),
        error_category: taxonomyDisplay.errorCategory || "",
        cognitive_skill: taxonomyDisplay.cognitiveSkill || "",
        taxonomy_dimension: taxonomyDisplay.taxonomyDimension || "",
        detection_method: log.detection_method || "",
        taxonomy_version: log.taxonomy_version || "",
        confidence: Number.isFinite(Number(log.confidence)) ? Number(log.confidence) : null,
        text_snippet: resolveDetailTextSnippet(log),
        user_answer: log.user_answer || "",
        correct_answer: log.correct_answer || "",
        explanation: log.explanation || "",
        taxonomy_reason: buildTaxonomyReason(log),
      });
    });
  });

  const speakings = await SpeakingSession.find({ userId: userId, "error_logs.0": { $exists: true } })
    .sort({ timestamp: -1, createdAt: -1 })
    .select("_id questionId timestamp createdAt error_logs")
    .lean();
  speakings.forEach((speakingDoc) => {
    const loggedAt = speakingDoc.timestamp || speakingDoc.createdAt;
    toSafeErrorLogArray(speakingDoc?.error_logs).forEach((log, index) => {
      const taxonomyDisplay = resolveTaxonomyDisplay(log);
      details.push({
        id: `speaking:${speakingDoc._id}:${index}`,
        source_type: "speaking_session",
        source_id: String(speakingDoc._id),
        source_label: "Phien noi",
        source_ref: speakingDoc.questionId || null,
        skill: "speaking",
        logged_at: loggedAt,
        task_type: log.task_type || "unknown",
        task_type_label: formatQuestionType(log.task_type || "unknown"),
        question_number: log.question_number || null,
        error_code: log.error_code || "UNCLASSIFIED",
        error_label: getErrorLabel(log),
        error_category: taxonomyDisplay.errorCategory || "",
        cognitive_skill: taxonomyDisplay.cognitiveSkill || "",
        taxonomy_dimension: taxonomyDisplay.taxonomyDimension || "",
        detection_method: log.detection_method || "",
        taxonomy_version: log.taxonomy_version || "",
        confidence: Number.isFinite(Number(log.confidence)) ? Number(log.confidence) : null,
        text_snippet: resolveDetailTextSnippet(log),
        user_answer: log.user_answer || "",
        correct_answer: log.correct_answer || "",
        explanation: log.explanation || "",
        taxonomy_reason: buildTaxonomyReason(log),
      });
    });
  });

  return details;
}

const COMPLETION_CANONICAL_TYPES = new Set([
  "gap_fill",
  "note_completion",
  "summary_completion",
  "sentence_completion",
  "form_completion",
  "table_completion",
  "flow_chart_completion",
  "diagram_label_completion",
]);

const canonicalQuestionType = (rawType = "") => {
  const type = String(rawType || "unknown").toLowerCase();

  if (COMPLETION_CANONICAL_TYPES.has(type)) return "note_completion";
  if (type === "matching_info") return "matching_information";
  if (type === "true_false_notgiven" || type === "true_false_not_given" || type === "tfng") return "tfng";
  if (type === "yes_no_notgiven" || type === "yes_no_not_given" || type === "ynng") return "ynng";
  if (type === "mult_choice" || type === "multiple_choice_single" || type === "multiple_choice_multi" || type === "mult_choice_multi") {
    return "multiple_choice";
  }

  return type;
};

const formatQuestionType = (type = "") => {
  const canonicalType = canonicalQuestionType(type);
  const labels = {
    tfng: "True / False / Not Given",
    ynng: "Yes / No / Not Given",
    multiple_choice: "Multiple Choice",
    note_completion: "Note Completion",
    summary_completion: "Summary Completion",
    sentence_completion: "Sentence Completion",
    table_completion: "Table Completion",
    flow_chart_completion: "Flow-chart Completion",
    form_completion: "Form Completion",
    map_labeling: "Map Labeling",
    diagram_labeling: "Diagram Labeling",
    matching_headings: "Matching Headings",
    matching_features: "Matching Features",
    matching_information: "Matching Information",
    matching_sentence_endings: "Matching Sentence Endings",
    matching: "Matching",
    short_answer: "Short Answer",
    plan_map_diagram: "Plan / Map / Diagram Labeling",
    listening_map: "Listening Map Labeling",
    task1: "Writing Task 1",
    task2: "Writing Task 2",
    part1: "Speaking Part 1",
    part2: "Speaking Part 2",
    part3: "Speaking Part 3",
  };

  if (labels[canonicalType]) return labels[canonicalType];

  return canonicalType
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const serializeHistoryRecords = (records = []) =>
  records
    .filter((item) => item?.date && Number.isFinite(Number(item?.score)))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((item) => ({
      date: item.date,
      score: roundOne(item.score),
      type: item.type,
    }));

const buildAnalyticsPayload = async (targetUserId) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    const error = new Error("Invalid user id");
    error.status = 400;
    throw error;
  }

  const objectId = new mongoose.Types.ObjectId(targetUserId);

  const [attempts, writingSubmissions, speakingSessions, weaknessRows] = await Promise.all([
    TestAttempt.find({
      user_id: objectId,
      type: { $in: ["reading", "listening"] },
      score: { $ne: null },
    })
      .select("type score total percentage submitted_at time_taken_ms")
      .lean(),
    WritingSubmission.find({
      user_id: objectId,
      status: { $in: ["scored", "reviewed"] },
      score: { $ne: null },
    })
      .select("score submitted_at")
      .lean(),
    SpeakingSession.find({
      userId: objectId,
      status: "completed",
      "analysis.band_score": { $ne: null },
    })
      .select("analysis.band_score timestamp")
      .lean(),
    TestAttempt.aggregate([
      { $match: { user_id: objectId, "detailed_answers.0": { $exists: true } } },
      { $unwind: "$detailed_answers" },
      {
        $group: {
          _id: "$detailed_answers.question_type",
          totalQuestions: { $sum: 1 },
          correctQuestions: {
            $sum: { $cond: [{ $eq: ["$detailed_answers.is_correct", true] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  let readingCorrectWeighted = 0;
  let readingTotalWeighted = 0;
  const readingLegacyBands = [];
  const readingObjectiveHistoryRaw = attempts
    .filter((item) => item.type === "reading")
    .map((item) => {
      const parsed = parseObjectiveAttempt({
        score: item.score,
        total: item.total,
        percentage: item.percentage,
        type: "reading",
      });

      if (Number.isFinite(parsed.weightedCorrect) && Number.isFinite(parsed.weightedTotal) && parsed.weightedTotal > 0) {
        readingCorrectWeighted += parsed.weightedCorrect;
        readingTotalWeighted += parsed.weightedTotal;
      } else {
        readingLegacyBands.push(parsed.band);
      }

      return {
        type: "reading",
        score: parsed.band,
        date: item.submitted_at,
      };
    });

  let listeningCorrectWeighted = 0;
  let listeningTotalWeighted = 0;
  const listeningLegacyBands = [];
  const listeningObjectiveHistoryRaw = attempts
    .filter((item) => item.type === "listening")
    .map((item) => {
      const parsed = parseObjectiveAttempt({
        score: item.score,
        total: item.total,
        percentage: item.percentage,
        type: "listening",
      });

      if (Number.isFinite(parsed.weightedCorrect) && Number.isFinite(parsed.weightedTotal) && parsed.weightedTotal > 0) {
        listeningCorrectWeighted += parsed.weightedCorrect;
        listeningTotalWeighted += parsed.weightedTotal;
      } else {
        listeningLegacyBands.push(parsed.band);
      }

      return {
        type: "listening",
        score: parsed.band,
        date: item.submitted_at,
      };
    });

  const {
    readingHistoryRaw,
    listeningHistoryRaw,
    writingHistoryRaw,
    speakingHistoryRaw,
    allHistoryRaw,
  } = buildAnalyticsHistoryRaw({
    attempts,
    writingSubmissions,
    speakingSessions,
  });

  const readingBand = readingTotalWeighted > 0
    ? roundHalf(toBandScore((readingCorrectWeighted / readingTotalWeighted) * 40, "reading"))
    : roundHalf(average(readingLegacyBands.length ? readingLegacyBands : readingObjectiveHistoryRaw.map((item) => item.score)));
  const listeningBand = listeningTotalWeighted > 0
    ? roundHalf(toBandScore((listeningCorrectWeighted / listeningTotalWeighted) * 40, "listening"))
    : roundHalf(average(listeningLegacyBands.length ? listeningLegacyBands : listeningObjectiveHistoryRaw.map((item) => item.score)));
  const writingBand = roundHalf(average(writingHistoryRaw.map((item) => item.score)));
  const speakingBand = roundHalf(average(speakingHistoryRaw.map((item) => item.score)));

  const skills = {
    reading: readingBand,
    listening: listeningBand,
    writing: writingBand,
    speaking: speakingBand,
  };

  const skillBreakdownBase = [
    { name: "Reading", score: readingBand },
    { name: "Writing", score: writingBand },
    { name: "Listening", score: listeningBand },
    { name: "Speaking", score: speakingBand },
  ];

  const totalSkillScore = skillBreakdownBase.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const skillBreakdown = skillBreakdownBase.map((item) => ({
    ...item,
    value: totalSkillScore > 0
      ? roundOne((Number(item.score || 0) / totalSkillScore) * 100)
      : 25,
  }));

  const { progressHistory } = buildAnalyticsProgressHistory({ allHistoryRaw, recentMonthCount: 7 });
  const summary = buildAnalyticsSummary({ attempts, allHistoryRaw, recentMonthCount: 7 });

  const weaknessMerged = weaknessRows.reduce((acc, item) => {
    const canonicalType = canonicalQuestionType(item?._id || "unknown");
    if (!acc[canonicalType]) {
      acc[canonicalType] = { totalQuestions: 0, correctQuestions: 0 };
    }
    acc[canonicalType].totalQuestions += Number(item?.totalQuestions || 0);
    acc[canonicalType].correctQuestions += Number(item?.correctQuestions || 0);
    return acc;
  }, {});

  const weaknesses = Object.entries(weaknessMerged)
    .map(([rawType, stat]) => {
      const totalQuestions = Number(stat.totalQuestions || 0);
      const accuracy = totalQuestions > 0
        ? (Number(stat.correctQuestions || 0) / totalQuestions) * 100
        : 0;

      return {
        category: formatQuestionType(rawType),
        score: roundOne(accuracy),
        fullMark: 100,
        total: totalQuestions,
        rawType,
      };
    })
    .sort((a, b) => a.score - b.score);

  return {
    summary,
    skills,
    skillBreakdown,
    weaknesses,
    progressHistory,
    history: serializeHistoryRecords(allHistoryRaw),
    legacyWeaknesses: weaknesses.map((item) => ({
      type: item.rawType,
      accuracy: item.score,
      total: item.total,
    })),
  };
};

const sendAnalyticsError = (req, res, error) => {
  const statusCode = Number(error?.statusCode || error?.status || 500);
  const message = error?.message || "Failed to load analytics";
  return handleControllerError(req, res, error, { statusCode, message });
};

export const getAnalyticsDashboard = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json(payload);
  } catch (error) {
    return sendAnalyticsError(req, res, error);
  }
};

export const getAdminStudentAnalyticsDashboard = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const payload = await buildAnalyticsPayload(req.params.studentId);
    return res.json(payload);
  } catch (error) {
    return sendAnalyticsError(req, res, error);
  }
};

// Legacy endpoints retained for compatibility with older frontend calls.
export const getSkillsBreakdown = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json({ skills: payload.skills });
  } catch (error) {
    return sendAnalyticsError(req, res, error);
  }
};

export const getWeaknessAnalysis = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json({ weaknesses: payload.legacyWeaknesses });
  } catch (error) {
    return sendAnalyticsError(req, res, error);
  }
};

export const getProgressHistory = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json({ history: payload.history });
  } catch (error) {
    return sendAnalyticsError(req, res, error);
  }
};

export const getStudentAnalytics = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const payload = await buildAnalyticsPayload(req.params.studentId);
    return res.json({
      skills: payload.skills,
      weaknesses: payload.legacyWeaknesses,
      history: payload.history,
    });
  } catch (error) {
    return sendAnalyticsError(req, res, error);
  }
};

export const getErrorAnalytics = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const { userId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid user id"  });
    }
    const filters = parseAnalyticsFilters(req.query);
    const errorLogs = filterErrorLogs(await aggregateUserErrors(userId), filters);

    // Grouping logic for Heatmap (Task Type vs Error Category) and Bar Charts (Cognitive Skill frequency)
    const taskTypeVsCategory = {}; // { 'TFNG': { 'R-C4': 5, 'R-C1': 2 } }
    const cognitiveSkillCount = {}; // { 'Truy xuat thong tin': 10 }
    const codeLegend = {};
    const skillBreakdown = { reading: 0, listening: 0, writing: 0, speaking: 0 };
    const totalErrors = errorLogs.length;

    errorLogs.forEach(log => {
      const taxonomyDisplay = resolveTaxonomyDisplay(log);
      if (log.skill && Object.prototype.hasOwnProperty.call(skillBreakdown, log.skill)) {
        skillBreakdown[log.skill]++;
      }

      // Heatmap Aggregation
      const tType = log.task_type || 'Unknown';
      const eCode = log.error_code || 'UNCLASSIFIED';
      if (!taskTypeVsCategory[tType]) taskTypeVsCategory[tType] = {};
      taskTypeVsCategory[tType][eCode] = (taskTypeVsCategory[tType][eCode] || 0) + 1;
      if (!codeLegend[eCode]) {
        codeLegend[eCode] = taxonomyDisplay.errorLabel || "Chưa phân loại";
      }

      // Bar chart aggregation
      const cogSkill = taxonomyDisplay.cognitiveSkill || "Tổng quát";
      cognitiveSkillCount[cogSkill] = (cognitiveSkillCount[cogSkill] || 0) + 1;
    });

    // Convert dictionaries to array format for Recharts
    const heatmapData = Object.keys(taskTypeVsCategory).map(taskType => {
      const row = { taskType };
      Object.keys(taskTypeVsCategory[taskType]).forEach(code => {
        row[code] = taskTypeVsCategory[taskType][code];
      });
      return row;
    });

    const cognitiveData = Object.keys(cognitiveSkillCount).map(skillName => ({
      name: skillName,
      value: cognitiveSkillCount[skillName]
    })).sort((a, b) => b.value - a.value);

    return res.status(200).json({
      success: true,
      data: {
        filters: {
          range: filters.range,
          skill: filters.skill,
        },
        totalErrors,
        skillBreakdown,
        heatmapData,
        cognitiveData,
        codeLegend,
      }
    });

  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getErrorAnalyticsDetails = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const { userId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid user id"  });
    }

    const filters = parseAnalyticsFilters(req.query);
    const pagination = parseDetailsPagination(req.query);
    const totalFilters = normalizeErrorDetailsFilters(req.query);

    const rawDetails = await aggregateUserErrorDetails(userId);
    const scopedByTimeSkill = filterErrorLogs(rawDetails, filters);
    const scopedDetails = filterErrorDetails(scopedByTimeSkill, req.query)
      .sort((a, b) => new Date(b.logged_at || 0) - new Date(a.logged_at || 0));

    const total = scopedDetails.length;
    const totalPages = Math.max(1, Math.ceil(total / pagination.limit));
    const page = Math.min(pagination.page, totalPages);
    const start = (page - 1) * pagination.limit;
    const items = scopedDetails.slice(start, start + pagination.limit);

    return res.status(200).json({
      success: true,
      data: {
        filters: {
          range: filters.range,
          skill: filters.skill,
          errorCode: totalFilters.errorCode || "",
          taskType: totalFilters.taskType || "",
        },
        pagination: {
          page,
          limit: pagination.limit,
          total,
          totalPages,
        },
        items,
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getAIInsights = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const { userId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid user id"  });
    }
    const filters = parseAnalyticsFilters(req.query);
    const errorLogs = filterErrorLogs(await aggregateUserErrors(userId), filters);

    if (errorLogs.length === 0) {
      const emptyPayload = {
        no_data: true,
        feedback: "Ban chua co du du lieu loi de phan tich. Hay lam them cac bai kiem tra hoac bai tap thuc hanh nhe.",
        overview: "Ban chua co du du lieu loi de phan tich. Hay lam them cac bai kiem tra hoac bai tap thuc hanh nhe.",
        actionable_advice: [],
        recommended_practice: [],
        encouragement: "",
        filters: {
          range: filters.range,
          skill: filters.skill,
        },
      };
      return res.status(200).json({ success: true, data: emptyPayload });
    }

    const latestErrorMs = errorLogs.reduce((max, log) => {
      const ts = new Date(log?.logged_at).getTime();
      if (Number.isNaN(ts)) return max;
      return Math.max(max, ts);
    }, 0);
    const cacheKey = toInsightsCacheKey(
      `${userId}|${filters.range}|${filters.skill}|${errorLogs.length}|${latestErrorMs}`,
    );
    let cachedInsights = null;
    try {
      cachedInsights = await getJson(cacheKey);
    } catch (cacheError) {
      console.warn("[analytics] Redis cache read fallback:", cacheError?.message || "Unknown error");
    }
    if (cachedInsights && typeof cachedInsights === "object") {
      return res.status(200).json({ success: true, data: cachedInsights });
    }

    const frequencies = {};
    errorLogs.forEach((log) => {
      const key = `Skill: ${log.skill} | Task Type: ${log.task_type} | Category: ${log.error_category} | Code: ${log.error_code}`;
      frequencies[key] = (frequencies[key] || 0) + 1;
    });

    const topErrors = Object.entries(frequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([desc, count]) => `- ${desc} (${count})`);

    const prompt = `Analyze the student's IELTS error taxonomy and return strict JSON in Vietnamese.\nTop errors:\n${topErrors.join("\n")}\n\nReturn exactly:\n{\n  \"overview\": \"string\",\n  \"actionable_advice\": [\"string\"],\n  \"recommended_practice\": [\"string\"],\n  \"encouragement\": \"string\"\n}`;

    let normalizedPayload = null;
    if (!process.env.OPENAI_API_KEY) {
      normalizedPayload = buildHeuristicInsightsPayload(errorLogs, filters);
    } else {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Return valid JSON only. Use Vietnamese language." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        });

        const parsedInsights = JSON.parse(response?.choices?.[0]?.message?.content || "{}");
        normalizedPayload = {
          no_data: false,
          feedback: parsedInsights.feedback || null,
          overview: parsedInsights.overview || "",
          actionable_advice: Array.isArray(parsedInsights.actionable_advice)
            ? parsedInsights.actionable_advice
            : [parsedInsights.actionable_advice].filter(Boolean),
          recommended_practice: Array.isArray(parsedInsights.recommended_practice)
            ? parsedInsights.recommended_practice
            : [parsedInsights.recommended_practice].filter(Boolean),
          encouragement: parsedInsights.encouragement || "",
          filters: {
            range: filters.range,
            skill: filters.skill,
          },
        };
      } catch (aiError) {
        console.warn("[analytics] AI insights fallback:", aiError?.message || "Unknown error");
        normalizedPayload = buildHeuristicInsightsPayload(errorLogs, filters);
      }
    }

    void setJson(cacheKey, normalizedPayload, AI_INSIGHTS_CACHE_TTL_SEC).catch(() => {
      // Cache write is best-effort.
    });
    return res.status(200).json({
      success: true,
      data: normalizedPayload,
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getAdminStudentErrorAnalytics = async (req, res) => {
  try {
    const scopedReq = Object.create(req);
    scopedReq.user = {
      ...req.user,
      userId: req.params.studentId,
    };
    return getErrorAnalytics(scopedReq, res);
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getAdminStudentErrorAnalyticsDetails = async (req, res) => {
  try {
    const scopedReq = Object.create(req);
    scopedReq.user = {
      ...req.user,
      userId: req.params.studentId,
    };
    return getErrorAnalyticsDetails(scopedReq, res);
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getAdminStudentAIInsights = async (req, res) => {
  try {
    const scopedReq = Object.create(req);
    scopedReq.user = {
      ...req.user,
      userId: req.params.studentId,
    };
    return getAIInsights(scopedReq, res);
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};


