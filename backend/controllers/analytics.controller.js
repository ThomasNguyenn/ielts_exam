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
import { loadAnalyticsSourceDataWithDelta } from "../services/analyticsSnapshot.service.js";
import { loadErrorAnalyticsEntriesWithDelta } from "../services/analyticsErrorSnapshot.service.js";
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
  FORM: "Sai yêu cầu hình thức (số từ, định dạng)",

  LEXICAL: "Lỗi dùng từ",

  INFERENCE: "Hiểu sai ý gián tiếp",

  DISCOURSE: "Chưa theo dõi đúng mạch nội dung",

  STRATEGY: "Cách làm bài chưa phù hợp",

  ATTENTION: "Thiếu tập trung khi làm bài",

  MEMORY: "Quên thông tin vừa nghe/đọc",

  TASK: "Chưa trả lời đúng trọng tâm đề bài",

  COHESION: "Liên kết giữa các câu chưa tốt",

  GRAMMAR: "Lỗi ngữ pháp",

  FLUENCY: "Nói chưa trôi chảy",

  COHERENCE: "Bài chưa mạch lạc, sắp xếp ý chưa rõ",

  PRONUNCIATION: "Phát âm chưa rõ",

  "Z. Unclassified": "Lỗi chưa phân loại",

  "Legacy (Deprecated)": "Mã lỗi cũ (không còn sử dụng)",
});

const COGNITIVE_LABELS_VI = Object.freeze({
  Retrieval: "Tìm thông tin trong bài",

  "Semantic Mapping": "Hiểu các cách diễn đạt khác nhau (paraphrase)",

  Inference: "Hiểu ý gián tiếp",

  "Discourse Tracking": "Theo dõi mạch nội dung trong đoạn",

  "Scope Monitoring": "Hiểu đúng phạm vi và mức độ thông tin",

  "Exec Control": "Quản lý cách làm bài và thời gian",

  Acoustic: "Phân biệt âm khi nghe",

  Segmentation: "Tách được các từ khi người nói nối âm",

  Prediction: "Dự đoán nội dung sắp xuất hiện",

  Attention: "Giữ tập trung khi làm bài",

  "Working Memory": "Ghi nhớ thông tin vừa nghe/đọc",

  "Idea Generation": "Nghĩ và phát triển ý tưởng",

  Planning: "Lập dàn ý trước khi nói/viết",

  "Lexical Retrieval": "Tìm từ phù hợp để dùng",

  "Syntax Construction": "Tạo câu đúng cấu trúc",

  "Monitoring Revision": "Tự kiểm tra và sửa lỗi",

  "Real-time Planning": "Vừa nói vừa sắp xếp ý",

  "Lexical Access": "Gọi đúng từ khi nói",

  "Grammatical Encoding": "Dùng ngữ pháp chính xác",

  "Phonological Encoding": "Phát âm đúng các âm",

  Monitoring: "Tự kiểm soát bài làm",

  General: "Lỗi chung",

  // Reading micro skills
  "R1. Literal Comprehension": "Hiểu thông tin được nêu trực tiếp",

  "R2. Paraphrase Recognition": "Nhận ra cách diễn đạt tương đương",

  "R3. Inference": "Suy ra ý không nói trực tiếp",

  "R4. Logical Relationship": "Hiểu quan hệ logic giữa các ý",

  "R5. Skimming / Scanning": "Đọc lướt và tìm nhanh thông tin",

  // Listening micro skills
  "L1. Sound Discrimination": "Phân biệt âm gần giống nhau",

  "L2. Word Boundary Detection": "Nhận ra ranh giới giữa các từ khi nối âm",

  "L3. Connected Speech Recognition": "Hiểu khi người nói nối âm tự nhiên",

  "L4. Number & Spelling Accuracy": "Nghe và ghi đúng số/chính tả",

  "L5. Attention Tracking": "Theo dõi thông tin xuyên suốt bài nghe",

  // Writing bands
  "W-TR. Task Response / Achievement": "Trả lời đúng và đủ yêu cầu đề bài",

  "W-CC. Coherence & Cohesion": "Sắp xếp ý mạch lạc và liên kết tốt",

  "W-LR. Lexical Resource": "Dùng từ vựng chính xác và đa dạng",

  "W-GRA. Grammatical Range & Accuracy": "Dùng ngữ pháp đúng và đa dạng",

  // Speaking bands
  "S-FC. Fluency & Coherence": "Nói trôi chảy và có mạch lạc",

  "S-LR. Lexical Resource": "Dùng từ khi nói chính xác và phong phú",

  "S-GRA. Grammatical Range & Accuracy": "Dùng ngữ pháp đúng khi nói",

  "S-PR. Pronunciation": "Phát âm rõ ràng, dễ hiểu",
});

const DIMENSION_LABELS_VI = Object.freeze({
  // READING
  "R.A.EXPLICIT": "Thông tin được nói trực tiếp",

  "R.A.INFERENCE": "Ý cần suy ra (không nói trực tiếp)",

  "R.A.WRITER_VIEW": "Quan điểm hoặc thái độ của tác giả",

  "R.A.LOGIC": "Cách các ý được nối và lập luận",

  "R.A.MAIN_IDEA": "Ý chính của đoạn",

  "R.A.PARAPHRASE": "Cách diễn đạt tương đương (paraphrase)",

  "R.A.FORM": "Đúng yêu cầu hình thức",

  "R.A.TIME_STRATEGY": "Quản lý thời gian khi làm bài",

  // LISTENING
  "L.A.PHONO_LEXICAL": "Nghe và nhận ra từ đúng",

  "L.A.CONNECTED_SPEECH": "Hiểu khi người nói nối âm",

  "L.A.DISTRACTOR": "Tránh bị đánh lừa bởi thông tin gây nhiễu",

  "L.A.FORM": "Đúng yêu cầu hình thức",

  "L.A.PREDICTIVE": "Dự đoán nội dung trước khi nghe",

  "L.A.WORKING_MEMORY": "Ghi nhớ thông tin vừa nghe",

  // WRITING
  "W.A.TASK_RESPONSE": "Trả lời đúng và đủ yêu cầu đề bài",

  "W.A.COHERENCE": "Sắp xếp ý mạch lạc",

  "W.A.LEXICAL": "Dùng từ chính xác và phù hợp",

  "W.A.GRAMMAR": "Dùng ngữ pháp đúng và đa dạng",

  // SPEAKING
  "S.A.FLUENCY_COHERENCE": "Nói trôi chảy và rõ ý",

  "S.A.LEXICAL": "Dùng từ khi nói chính xác",

  "S.A.GRAMMAR": "Ngữ pháp khi nói",

  "S.A.PRONUNCIATION": "Phát âm rõ ràng",

  // SYSTEM
  unclassified: "Lỗi chưa phân loại",

  deprecated_legacy: "Mã lỗi cũ (không còn sử dụng)",
});

const SUBTYPE_OVERRIDES_VI = Object.freeze({
  SPELLING: "Sai chính tả",

  PLURAL_S: "Sai số ít/số nhiều",

  WORD_FORM: "Sai loại từ (danh/động/tính từ...)",

  NUMBER_FORMAT: "Viết sai số hoặc định dạng số",

  PROPER_NOUN_FORMAT: "Viết sai tên riêng",

  WORD_LIMIT: "Vượt hoặc thiếu số từ quy định",

  INCOMPLETE_ANSWER: "Chưa trả lời đầy đủ",

  PARAPHRASE_MISS: "Không nhận ra cách diễn đạt tương đương",

  NEGATION_TRAP: "Hiểu sai do câu có phủ định",

  QUANTIFIER_SCOPE: "Hiểu sai mức độ (many, some, all…)",

  WRITER_ATTITUDE: "Hiểu sai thái độ/quan điểm của tác giả",

  WRITING_MISSING_OVERVIEW: "Thiếu đoạn tổng quan (overview)",

  WRITING_KEY_FEATURE_SELECTION: "Chọn sai đặc điểm quan trọng",

  WRITING_INSUFFICIENT_DEVELOPMENT: "Ý chưa được giải thích đầy đủ",

  WRITING_WORD_CHOICE: "Dùng từ chưa chính xác",

  SPEAKING_FLUENCY_BREAKDOWN: "Nói bị ngập ngừng hoặc ngắt quãng",

  SPEAKING_LEX_RANGE_LIMITED: "Vốn từ khi nói còn hạn chế",

  SPEAKING_PRON_INTELLIGIBILITY: "Phát âm chưa rõ, người nghe khó hiểu",

  MCQ_INFERENCE_EXPLICIT: "Suy luận sai từ thông tin trực tiếp (trắc nghiệm)",

  SPEAKING_PRON_VOWEL_CONSONANT: "Phát âm sai nguyên âm hoặc phụ âm",

  CROSS_SENTENCE_LINK_FAIL: "Các câu chưa nối với nhau mượt mà",

  REFERENCE_CHAIN_MISS: "Không theo dõi được từ thay thế (he, it, they…)",

  BOUNDARY_SCOPE_DRIFT: "Hiểu sai phạm vi thông tin trong câu",

  WRITING_GR_SVA: "Sai hòa hợp chủ ngữ – động từ",
});

const TOKEN_VI = Object.freeze({
  MCQ: "trắc nghiệm",

  INFERENCE: "suy luận",

  EXPLICIT: "thông tin trực tiếp",

  TFNG: "true/false/not given",

  YNNG: "yes/no/not given",

  SPELL: "chính tả",
  SPELLING: "chính tả",

  PLUR: "số ít và số nhiều",

  WFORM: "loại từ",

  WORD: "từ",

  FORM: "hình thức",

  NUM: "số",
  NUMBER: "số",

  PN: "tên riêng",

  WLIM: "giới hạn số từ",

  OMIT: "bỏ trống",

  KEY: "từ khóa",

  SCOPE: "phạm vi",

  DIST: "thông tin gây nhiễu",
  DISTRACTOR: "thông tin gây nhiễu",

  NEG: "phủ định",

  PART: "một phần",

  OVER: "quá mức",

  QNT: "mức độ (many, some, all...)",

  OPF: "ý kiến và sự thật",

  PARA: "diễn đạt tương đương",

  STEM: "yêu cầu câu hỏi",

  TIME: "trình tự thời gian",

  QUAL: "từ chỉ mức độ",

  EXT: "từ mang nghĩa tuyệt đối",

  NGF: "nhầm giữa not given và false/no",

  MID: "ý chính và chi tiết",

  PFN: "chức năng của đoạn",

  SIG: "tín hiệu liên kết",

  BND: "ranh giới đoạn",

  ENT: "đối tượng và đặc điểm",

  PRO: "từ thay thế (he, it, they...)",

  TYPE: "dạng câu hỏi",

  SPAT: "vị trí trong không gian",

  LAND: "mốc địa điểm",

  ORI: "hướng trên bản đồ",

  ROUTE: "tuyến đường",

  SEQ: "thứ tự các bước",

  VIEW: "đổi góc nhìn",

  PREP: "giới từ vị trí",

  LINK: "liên kết",

  LINKO: "lạm dụng từ nối",

  LINKM: "nối câu chưa tự nhiên",

  PARA_BLOCK: "đoạn văn",

  PROG: "tiến trình ý tưởng",

  RNG: "độ đa dạng",

  CMPX: "câu phức",

  SVA: "hòa hợp chủ ngữ – động từ",

  TENSE: "thì",
  TEN: "thì",

  AP: "mạo từ và giới từ",

  CL: "ranh giới mệnh đề",

  INTEL: "độ rõ khi phát âm",

  PRON: "phát âm",

  VOWEL: "nguyên âm",

  CONSONANT: "phụ âm",

  SPEAKING: "bài nói",

  WST: "nhấn âm từ",

  SST: "nhấn âm câu",

  RHY: "nhịp điệu",

  CS: "nối âm",

  INTN: "ngữ điệu",

  VC: "nguyên âm và phụ âm",

  CHUNK: "ngắt cụm từ",

  WRITING: "bài viết",

  READING: "bài đọc",

  LISTENING: "bài nghe",

  GR: "ngữ pháp",

  LR: "từ vựng",

  TR: "đáp ứng đề bài",

  CC: "mạch lạc và liên kết",

  FC: "độ trôi chảy",

  PR: "phát âm",

  BOUNDARY: "ranh giới",

  DRIFT: "lệch nghĩa",
});

const SUBTYPE_PREFIX_FORMATTERS = Object.freeze([
  { prefix: "WRITING_GR_", label: "Lỗi ngữ pháp bài viết" },
  { prefix: "WRITING_LR_", label: "Lỗi từ vựng bài viết" },
  { prefix: "WRITING_TR_", label: "Lỗi đáp ứng đề bài viết" },
  { prefix: "WRITING_CC_", label: "Lỗi mạch lạc-liên kết bài viết" },
  { prefix: "SPEAKING_GR_", label: "Lỗi ngữ pháp bài nói" },
  { prefix: "SPEAKING_LR_", label: "Lỗi từ vựng bài nói" },
  { prefix: "SPEAKING_FC_", label: "Lỗi độ trôi chảy-mạch lạc bài nói" },
  { prefix: "SPEAKING_PR_", label: "Lỗi phát âm bài nói" },
  { prefix: "READING_", label: "Lỗi đọc" },
  { prefix: "LISTENING_", label: "Lỗi nghe" },
]);

const humanizeSubtypeTokens = (value = "") => {
  const compact = String(value || "")
    .replace(/[.\-/]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!compact) return "";

  return compact
    .split("_")
    .filter(Boolean)
    .map((token) => TOKEN_VI[token.toUpperCase()] || token.toLowerCase())
    .join(" ");
};

const humanizeSubtypeByPrefix = (normalizedSubtypeKey = "") => {
  if (!normalizedSubtypeKey) return "";

  const matched = SUBTYPE_PREFIX_FORMATTERS.find(({ prefix }) =>
    normalizedSubtypeKey.startsWith(prefix),
  );
  if (!matched) return "";

  const detailLabel = humanizeSubtypeTokens(normalizedSubtypeKey.slice(matched.prefix.length));
  return detailLabel ? `${matched.label}: ${detailLabel}` : matched.label;
};

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

  const prefixedLabel = humanizeSubtypeByPrefix(normalizedSubtypeKey);
  if (prefixedLabel) return prefixedLabel;

  return humanizeSubtypeTokens(normalized) || normalized;
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

  const {
    attempts,
    writingSubmissions,
    speakingSessions,
    weaknessRows,
  } = await loadAnalyticsSourceDataWithDelta(targetUserId);

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
    const errorLogs = filterErrorLogs(await loadErrorAnalyticsEntriesWithDelta(userId), filters);

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

    const rawDetails = await loadErrorAnalyticsEntriesWithDelta(userId);
    const scopedByTimeSkill = filterErrorLogs(rawDetails, filters);
    const scopedDetails = filterErrorDetails(scopedByTimeSkill, req.query)
      .sort((a, b) => new Date(b.logged_at || 0) - new Date(a.logged_at || 0));

    const total = scopedDetails.length;
    const totalPages = Math.max(1, Math.ceil(total / pagination.limit));
    const page = Math.min(pagination.page, totalPages);
    const start = (page - 1) * pagination.limit;
    const items = scopedDetails
      .slice(start, start + pagination.limit)
      .map((item) => {
        const taxonomyDisplay = resolveTaxonomyDisplay(item);
        return {
          ...item,
          task_type_label: formatQuestionType(item?.task_type || "unknown"),
          error_label: getErrorLabel(item),
          error_category: taxonomyDisplay.errorCategory || "",
          cognitive_skill: taxonomyDisplay.cognitiveSkill || "",
          taxonomy_dimension: taxonomyDisplay.taxonomyDimension || "",
          taxonomy_reason: buildTaxonomyReason(item),
        };
      });

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


