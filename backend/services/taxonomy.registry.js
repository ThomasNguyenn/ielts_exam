import { coreDimensions, errorTaxonomy, questionTypeMaps } from "../constants/ieltsErrorTaxonomy.js";

export const TAXONOMY_VERSION = "ielts_taxonomy_v2";

const SUPPORTED_SKILLS = new Set(["reading", "listening", "writing", "speaking"]);

export const normalizeErrorCode = (errorCode) => String(errorCode || "").trim().toUpperCase();

export const normalizeSkillDomain = (skill) => {
  const normalized = String(skill || "").trim().toLowerCase();
  return SUPPORTED_SKILLS.has(normalized) ? normalized : null;
};

const QUESTION_TYPE_ALIASES = {
  true_false_notgiven: "true_false_not_given",
  tfng: "true_false_not_given",
  yes_no_notgiven: "yes_no_not_given",
  ynng: "yes_no_not_given",
  summary: "summary_completion",
  sentence: "sentence_completion",
  note: "note_completion",
  table: "table_completion",
  flowchart_completion: "flow_chart_completion",
  flow_chart: "flow_chart_completion",
  plan_map_diagram: "map_labeling",
  listening_map: "map_labeling",
  map_labelling: "map_labeling",
  map_labeling: "map_labeling",
  diagram_label_completion: "diagram_labeling",
  diagram_completion: "diagram_labeling",
  matching_info: "matching_information",
  matching_heading: "matching_headings",
  multiple_choice_single: "multiple_choice",
  multiple_choice_multi: "multiple_choice",
  mult_choice: "multiple_choice",
  mult_choice_multi: "multiple_choice",
  task1: "task1",
  task2: "task2",
  part1: "part1",
  part2: "part2",
  part3: "part3",
};

export const normalizeQuestionType = (questionType) => {
  const raw = String(questionType || "unknown").trim().toLowerCase();
  const base = raw.replace(/[\s-]+/g, "_");
  return QUESTION_TYPE_ALIASES[base] || base;
};

const QUESTION_TYPE_TO_TAXONOMY = {
  true_false_not_given: "tfng",
  yes_no_not_given: "ynng",
  flow_chart_completion: "flowchart_completion",
  diagram_labeling: "diagram_labeling",
  map_labeling: "map_labeling",
  task1: "task1_academic",
  task2: "task2_essay",
  part1: "speaking_part_1",
  part2: "speaking_part_2",
  part3: "speaking_part_3",
};

const toTaxonomyQuestionType = (questionType = "unknown") => {
  const normalized = normalizeQuestionType(questionType);
  return QUESTION_TYPE_TO_TAXONOMY[normalized] || normalized;
};

const toMeta = (entry) => ({
  skill: entry.skill,
  dimension: entry.assessment?.code || "unclassified",
  category: entry.errorCategory || "Z. Unclassified",
  label: entry.errorSubtype || entry.code,
  cognitiveSkill: entry.cognitive?.label || "General",
  questionType: entry.questionType,
  assessmentLabel: entry.assessment?.label || "",
  cognitiveCode: entry.cognitive?.code || "",
});

const TAXONOMY_META_BY_CODE = Object.freeze(
  Object.fromEntries(
    Object.entries(errorTaxonomy).map(([code, entry]) => [code, toMeta(entry)]),
  ),
);

const FALLBACK_META_BY_CODE = Object.freeze({
  "R-UNCLASSIFIED": {
    skill: "reading",
    dimension: "unclassified",
    category: "Z. Unclassified",
    label: "Unclassified reading error",
    cognitiveSkill: "General",
  },
  "L-UNCLASSIFIED": {
    skill: "listening",
    dimension: "unclassified",
    category: "Z. Unclassified",
    label: "Unclassified listening error",
    cognitiveSkill: "General",
  },
  "W-UNCLASSIFIED": {
    skill: "writing",
    dimension: "unclassified",
    category: "Z. Unclassified",
    label: "Unclassified writing error",
    cognitiveSkill: "General",
  },
  "S-UNCLASSIFIED": {
    skill: "speaking",
    dimension: "unclassified",
    category: "Z. Unclassified",
    label: "Unclassified speaking error",
    cognitiveSkill: "General",
  },
});

const LEGACY_DEPRECATED_META_BY_CODE = Object.freeze({
  "L-T1": {
    skill: "listening",
    dimension: "deprecated_legacy",
    category: "Legacy (Deprecated)",
    label: "Legacy TFNG compatibility code",
    cognitiveSkill: "General",
  },
  "L-T2": {
    skill: "listening",
    dimension: "deprecated_legacy",
    category: "Legacy (Deprecated)",
    label: "Legacy TFNG compatibility code",
    cognitiveSkill: "General",
  },
  "L-T3": {
    skill: "listening",
    dimension: "deprecated_legacy",
    category: "Legacy (Deprecated)",
    label: "Legacy TFNG compatibility code",
    cognitiveSkill: "General",
  },
  "L-T4": {
    skill: "listening",
    dimension: "deprecated_legacy",
    category: "Legacy (Deprecated)",
    label: "Legacy TFNG compatibility code",
    cognitiveSkill: "General",
  },
});

const LEGACY_TO_CANONICAL = Object.freeze({
  "R-A1": "R.NC.SPELL",
  "R-A2": "R.NC.PLUR",
  "R-A3": "R.NC.WFORM",
  "R-A4": "R.NC.NUM",
  "R-A5": "R.NC.WLIM",
  "R-A6": "R.NC.WLIM",
  "R-C1": "R.NC.KEY",
  "R-C2": "R.MH.PARA",
  "R-C3": "R.MH.MID",
  "R-C4": "R.MCQ.DIST",
  "R-C5": "R.NC.SCOPE",
  "R-T1": "R.TFNG.NGF",
  "R-T2": "R.TFNG.NEG",
  "R-T3": "R.TFNG.OVER",
  "R-T4": "R.TFNG.PART",
  "R-M1": "R.MH.PARA",
  "R-M2": "R.MH.MID",
  "R-M3": "R.MH.PFN",
  "R-S1": "R.MCQ.STEM",
  "R-S2": "R.TFNG.OVER",
  "R-S3": "R.MCQ.DIST",
  "R-S4": "R.NC.KEY",

  "L-A1": "L.NC.SPELL",
  "L-A2": "L.NC.SPELL",
  "L-A3": "L.NC.SPELL",
  "L-A4": "L.NC.SPELL",
  "L-A5": "L.SEN.SEG",
  "L-C1": "L.NC.NUM",
  "L-C2": "L.NC.PN",
  "L-C3": "L.NC.NUM",
  "L-C4": "L.NC.SIM",
  "L-C5": "L.NC.DIST",
  "L-C6": "L.MCQ.SYN",
  "L-K1": "L.NC.HEAR",
  "L-K2": "L.NC.LATE",
  "L-K3": "L.MCQ.LAST",

  "W1-T1": "W.T1.OVR",
  "W1-T2": "W.T1.KEY",
  "W1-T3": "W.T1.COMP",
  "W1-T4": "W.T1.GRP",
  "W1-G1": "W.GRA.TENSE",
  "W1-G2": "W.GRA.CMPX",
  "W1-G3": "W.GRA.AP",
  "W1-G4": "W.GRA.SVA",
  "W1-L1": "W.LR.REP",
  "W1-L2": "W.LR.REG",
  "W1-L3": "W.LR.COL",
  "W1-C1": "W.CC.LINKM",
  "W1-C2": "W.CC.LINKO",
  "W1-C3": "W.CC.LINKO",
  "W1-C4": "W.CC.PARA",
  "W2-T1": "W.T2.PROM",
  "W2-T2": "W.T2.POS",
  "W2-T3": "W.T2.DEV",
  "W2-T4": "W.T2.PROM",
  "W2-C1": "W.CC.PARA",
  "W2-C2": "W.CC.LINKM",
  "W2-C3": "W.T2.PROG",
  "W2-G1": "W.GRA.CMPX",
  "W2-G2": "W.GRA.CL",
  "W2-G3": "W.GRA.CL",
  "W2-L1": "W.LR.WCH",
  "W2-L2": "W.LR.COL",
  "W2-L3": "W.LR.WCH",

  "S-F1": "S.FC.FL",
  "S-F2": "S.FC.FIL",
  "S-F3": "S.FC.SC",
  "S-F4": "S.FC.LOG",
  "S-L1": "S.LR.RPT",
  "S-L2": "S.LR.WCH",
  "S-L3": "S.LR.RNG",
  "S-L4": "S.LR.COL",
  "S-G1": "S.GRA.TEN",
  "S-G2": "S.GRA.SVA",
  "S-G3": "S.GRA.SIM",
  "S-G4": "S.GRA.CMPX",
  "S-P1": "S.PRON.WST",
  "S-P2": "S.PRON.SST",
  "S-P3": "S.PRON.VC",
  "S-P4": "S.PRON.INTN",
});

const resolveCanonicalErrorCode = (errorCode) => {
  const normalized = normalizeErrorCode(errorCode);
  return LEGACY_TO_CANONICAL[normalized] || normalized;
};

const FALLBACK_CODE_BY_SKILL = {
  reading: "R-UNCLASSIFIED",
  listening: "L-UNCLASSIFIED",
  writing: "W-UNCLASSIFIED",
  speaking: "S-UNCLASSIFIED",
};

export const TAXONOMY = Object.freeze({
  reading: Object.freeze({
    core_cognitive_skills: coreDimensions.reading.cognitive.map((c) => c.label),
    question_types: Object.keys(questionTypeMaps.reading),
  }),
  listening: Object.freeze({
    core_cognitive_skills: coreDimensions.listening.cognitive.map((c) => c.label),
    question_types: Object.keys(questionTypeMaps.listening),
  }),
  writing: Object.freeze({
    core_cognitive_skills: coreDimensions.writing.cognitive.map((c) => c.label),
    question_types: Object.keys(questionTypeMaps.writing),
  }),
  speaking: Object.freeze({
    core_cognitive_skills: coreDimensions.speaking.cognitive.map((c) => c.label),
    question_types: Object.keys(questionTypeMaps.speaking),
  }),
});

const CANONICAL_CODES_BY_SKILL = Object.freeze(
  Object.keys(errorTaxonomy).reduce((acc, code) => {
    const skill = errorTaxonomy[code].skill;
    if (!acc[skill]) acc[skill] = [];
    acc[skill].push(code);
    return acc;
  }, {}),
);

export const ERROR_CODE_DEFINITIONS = Object.freeze({
  ...TAXONOMY_META_BY_CODE,
  ...FALLBACK_META_BY_CODE,
  ...LEGACY_DEPRECATED_META_BY_CODE,
});
const clampConfidence = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(1, num));
};

export const getErrorCodeMeta = (errorCode) => {
  const normalized = normalizeErrorCode(errorCode);
  if (ERROR_CODE_DEFINITIONS[normalized]) {
    return ERROR_CODE_DEFINITIONS[normalized];
  }
  const canonical = resolveCanonicalErrorCode(normalized);
  return ERROR_CODE_DEFINITIONS[canonical] || null;
};

export const getFallbackErrorCode = (skillDomain) =>
  FALLBACK_CODE_BY_SKILL[normalizeSkillDomain(skillDomain)] || "R-UNCLASSIFIED";

export const isValidErrorCodeForSkill = (errorCode, skillDomain) => {
  const skill = normalizeSkillDomain(skillDomain);
  if (!skill) return false;
  const meta = getErrorCodeMeta(errorCode);
  return Boolean(meta && meta.skill === skill);
};

export const listErrorCodesForSkill = (skillDomain) => {
  const skill = normalizeSkillDomain(skillDomain);
  if (!skill) return [];
  return [...(CANONICAL_CODES_BY_SKILL[skill] || [])].sort();
};

export const listErrorCodesForSkillAndQuestionType = (skillDomain, questionType) => {
  const skill = normalizeSkillDomain(skillDomain);
  if (!skill) return [];

  const normalizedType = normalizeQuestionType(questionType);
  const taxonomyType = toTaxonomyQuestionType(normalizedType);
  const map = questionTypeMaps[skill] || {};
  const byType = map[taxonomyType];

  if (Array.isArray(byType) && byType.length > 0) {
    return [...byType].sort();
  }

  return listErrorCodesForSkill(skill);
};

export const resolveCognitiveSkill = ({ skillDomain, questionType, errorCode }) => {
  const skill = normalizeSkillDomain(skillDomain);
  const meta = getErrorCodeMeta(errorCode);
  if (meta?.cognitiveSkill) return meta.cognitiveSkill;

  if (!skill) return "General";

  const normalizedType = normalizeQuestionType(questionType);
  const taxonomyType = toTaxonomyQuestionType(normalizedType);
  const codes = questionTypeMaps[skill]?.[taxonomyType] || [];
  if (codes.length > 0) {
    const firstMeta = getErrorCodeMeta(codes[0]);
    if (firstMeta?.cognitiveSkill) return firstMeta.cognitiveSkill;
  }

  return coreDimensions[skill]?.cognitive?.[0]?.label || "General";
};

const normalizeSecondaryCodes = ({ secondaryErrorCodes, primaryCode, skillDomain }) => {
  const list = Array.isArray(secondaryErrorCodes) ? secondaryErrorCodes : [];
  return list
    .map((code) => resolveCanonicalErrorCode(code))
    .filter((code) => code && code !== primaryCode)
    .filter((code) => isValidErrorCodeForSkill(code, skillDomain));
};

export const createTaxonomyErrorLog = ({
  skillDomain,
  taskType,
  questionType,
  errorCode,
  questionNumber,
  userAnswer,
  correctAnswer,
  studentHighlights = [],
  textSnippet = "",
  explanation = "",
  metaError,
  detectionMethod = "system",
  confidence = null,
  secondaryErrorCodes = [],
  cognitiveSkill,
  errorCategory,
} = {}) => {
  const inferredSkill = getErrorCodeMeta(errorCode)?.skill;
  const normalizedSkill = normalizeSkillDomain(skillDomain) || inferredSkill || "reading";

  const canonicalQuestionType = normalizeQuestionType(questionType || taskType || "unknown");

  const normalizedCode = resolveCanonicalErrorCode(errorCode);
  const primaryCode = isValidErrorCodeForSkill(normalizedCode, normalizedSkill)
    ? normalizedCode
    : getFallbackErrorCode(normalizedSkill);

  const meta = getErrorCodeMeta(primaryCode);

  return {
    task_type: canonicalQuestionType,
    question_type: canonicalQuestionType,
    cognitive_skill:
      cognitiveSkill ||
      meta?.cognitiveSkill ||
      resolveCognitiveSkill({
        skillDomain: normalizedSkill,
        questionType: canonicalQuestionType,
        errorCode: primaryCode,
      }),
    error_category: errorCategory || meta?.category || "Z. Unclassified",
    error_code: primaryCode,
    question_number: questionNumber,
    user_answer: userAnswer,
    correct_answer: correctAnswer,
    student_highlights: Array.isArray(studentHighlights) ? studentHighlights : [],
    text_snippet: String(textSnippet || ""),
    explanation: String(explanation || ""),
    meta_error: metaError,
    skill_domain: normalizedSkill,
    taxonomy_dimension: meta?.dimension || "unclassified",
    detection_method: String(detectionMethod || "system"),
    confidence: clampConfidence(confidence),
    secondary_error_codes: normalizeSecondaryCodes({
      secondaryErrorCodes,
      primaryCode,
      skillDomain: normalizedSkill,
    }),
    taxonomy_version: TAXONOMY_VERSION,
  };
};
