export const TAXONOMY_VERSION = "ielts_taxonomy_v1";

const readingCoreSkills = [
  "R1. Literal Comprehension",
  "R2. Paraphrase Recognition",
  "R3. Inference",
  "R4. Logical Relationship",
  "R5. Skimming / Scanning",
];

const listeningCoreSkills = [
  "L1. Sound Discrimination",
  "L2. Word Boundary Detection",
  "L3. Connected Speech Recognition",
  "L4. Number & Spelling Accuracy",
  "L5. Attention Tracking",
];

const writingCoreSkills = [
  "W-TR. Task Response / Achievement",
  "W-CC. Coherence & Cohesion",
  "W-LR. Lexical Resource",
  "W-GRA. Grammatical Range & Accuracy",
];

const speakingCoreSkills = [
  "S-FC. Fluency & Coherence",
  "S-LR. Lexical Resource",
  "S-GRA. Grammatical Range & Accuracy",
  "S-PR. Pronunciation",
];

const def = (skill, dimension, category, label, cognitiveSkill = null) => ({
  skill,
  dimension,
  category,
  label,
  cognitiveSkill,
});

const READING_CODES = {
  "R-A1": def("reading", "answer_level", "A. Answer-Level Errors", "Spelling Error", "R1. Literal Comprehension"),
  "R-A2": def("reading", "answer_level", "A. Answer-Level Errors", "Plural / Singular Error", "R1. Literal Comprehension"),
  "R-A3": def("reading", "answer_level", "A. Answer-Level Errors", "Word Form Error", "R2. Paraphrase Recognition"),
  "R-A4": def("reading", "answer_level", "A. Answer-Level Errors", "Number Format Error", "R1. Literal Comprehension"),
  "R-A5": def("reading", "answer_level", "A. Answer-Level Errors", "Exceed Word Limit", "R1. Literal Comprehension"),
  "R-A6": def("reading", "answer_level", "A. Answer-Level Errors", "Incomplete Answer", "R1. Literal Comprehension"),
  "R-C1": def("reading", "comprehension", "B. Comprehension Errors", "Wrong Keyword Selection", "R2. Paraphrase Recognition"),
  "R-C2": def("reading", "comprehension", "B. Comprehension Errors", "Paraphrase Miss", "R2. Paraphrase Recognition"),
  "R-C3": def("reading", "comprehension", "B. Comprehension Errors", "Main Idea Confusion", "R3. Inference"),
  "R-C4": def("reading", "comprehension", "B. Comprehension Errors", "Detail Trap", "R3. Inference"),
  "R-C5": def("reading", "comprehension", "B. Comprehension Errors", "Scope Error", "R5. Skimming / Scanning"),
  "R-T1": def("reading", "judgement_items", "C. Judgment Items (TFNG / YNNG)", "NOT GIVEN vs FALSE/NO Confusion", "R4. Logical Relationship"),
  "R-T2": def("reading", "judgement_items", "C. Judgment Items (TFNG / YNNG)", "TRUE/YES vs FALSE/NO Opposition Trap", "R4. Logical Relationship"),
  "R-T3": def("reading", "judgement_items", "C. Judgment Items (TFNG / YNNG)", "Over-Inference", "R3. Inference"),
  "R-T4": def("reading", "judgement_items", "C. Judgment Items (TFNG / YNNG)", "Partial Information Trap", "R4. Logical Relationship"),
  "R-M1": def("reading", "matching_heading", "D. Matching Heading Errors", "Similar Meaning Confusion", "R2. Paraphrase Recognition"),
  "R-M2": def("reading", "matching_heading", "D. Matching Heading Errors", "Detail vs Main Idea", "R3. Inference"),
  "R-M3": def("reading", "matching_heading", "D. Matching Heading Errors", "Tone Misinterpretation", "R3. Inference"),
  "R-S1": def("reading", "strategy", "E. Strategy Errors", "Poor Time Management", "R5. Skimming / Scanning"),
  "R-S2": def("reading", "strategy", "E. Strategy Errors", "Overthinking", "R3. Inference"),
  "R-S3": def("reading", "strategy", "E. Strategy Errors", "Random Guessing", "R5. Skimming / Scanning"),
  "R-S4": def("reading", "strategy", "E. Strategy Errors", "Highlight Irrelevant Text", "R2. Paraphrase Recognition"),
  "R-UNCLASSIFIED": def("reading", "unclassified", "Z. Unclassified", "Unclassified reading error", "R1. Literal Comprehension"),
};

const LISTENING_CODES = {
  "L-A1": def("listening", "surface", "A. Surface Errors", "Spelling Error", "L4. Number & Spelling Accuracy"),
  "L-A2": def("listening", "surface", "A. Surface Errors", "Plural / Singular", "L4. Number & Spelling Accuracy"),
  "L-A3": def("listening", "surface", "A. Surface Errors", "Hyphen Error", "L4. Number & Spelling Accuracy"),
  "L-A4": def("listening", "surface", "A. Surface Errors", "Capitalization", "L4. Number & Spelling Accuracy"),
  "L-A5": def("listening", "surface", "A. Surface Errors", "Article Omission", "L4. Number & Spelling Accuracy"),
  "L-C1": def("listening", "listening_specific", "B. Listening-Specific Errors", "Missed Number", "L1. Sound Discrimination"),
  "L-C2": def("listening", "listening_specific", "B. Listening-Specific Errors", "Missed Proper Noun", "L2. Word Boundary Detection"),
  "L-C3": def("listening", "listening_specific", "B. Listening-Specific Errors", "Missed Date / Time", "L4. Number & Spelling Accuracy"),
  "L-C4": def("listening", "listening_specific", "B. Listening-Specific Errors", "Confused Similar Sounds", "L1. Sound Discrimination"),
  "L-C5": def("listening", "listening_specific", "B. Listening-Specific Errors", "Distractor Trap", "L5. Attention Tracking"),
  "L-C6": def("listening", "listening_specific", "B. Listening-Specific Errors", "Synonym Miss", "L3. Connected Speech Recognition"),
  "L-K1": def("listening", "test_taking", "C. Test-taking & Attention Errors", "Attention Lapse", "L5. Attention Tracking"),
  "L-K2": def("listening", "test_taking", "C. Test-taking & Attention Errors", "Late Transfer / Response Delay", "L5. Attention Tracking"),
  "L-K3": def("listening", "test_taking", "C. Test-taking & Attention Errors", "Working Memory Overload", "L5. Attention Tracking"),
  "L-UNCLASSIFIED": def("listening", "unclassified", "Z. Unclassified", "Unclassified listening error", "L5. Attention Tracking"),
};

// Legacy codes kept only for backward compatibility with existing historical data.
const LEGACY_LISTENING_CODES = {
  "L-T1": def("listening", "deprecated_legacy", "Legacy (Deprecated)", "Legacy TFNG compatibility code", "L5. Attention Tracking"),
  "L-T2": def("listening", "deprecated_legacy", "Legacy (Deprecated)", "Legacy TFNG compatibility code", "L5. Attention Tracking"),
  "L-T3": def("listening", "deprecated_legacy", "Legacy (Deprecated)", "Legacy TFNG compatibility code", "L5. Attention Tracking"),
  "L-T4": def("listening", "deprecated_legacy", "Legacy (Deprecated)", "Legacy TFNG compatibility code", "L5. Attention Tracking"),
};

const WRITING_CODES = {
  "W1-T1": def("writing", "task_achievement", "W1. Task Achievement Errors", "Missing Overview", "W-TR. Task Response / Achievement"),
  "W1-T2": def("writing", "task_achievement", "W1. Task Achievement Errors", "No Key Feature", "W-TR. Task Response / Achievement"),
  "W1-T3": def("writing", "task_achievement", "W1. Task Achievement Errors", "Wrong Data Comparison", "W-TR. Task Response / Achievement"),
  "W1-T4": def("writing", "task_achievement", "W1. Task Achievement Errors", "Over-Detail", "W-TR. Task Response / Achievement"),
  "W1-G1": def("writing", "grammar", "W1. Grammar Errors", "Tense Error", "W-GRA. Grammatical Range & Accuracy"),
  "W1-G2": def("writing", "grammar", "W1. Grammar Errors", "Comparison Structure Error", "W-GRA. Grammatical Range & Accuracy"),
  "W1-G3": def("writing", "grammar", "W1. Grammar Errors", "Preposition Error", "W-GRA. Grammatical Range & Accuracy"),
  "W1-G4": def("writing", "grammar", "W1. Grammar Errors", "Agreement Error", "W-GRA. Grammatical Range & Accuracy"),
  "W1-L1": def("writing", "lexical", "W1. Lexical Errors", "Repetition", "W-LR. Lexical Resource"),
  "W1-L2": def("writing", "lexical", "W1. Lexical Errors", "Informal Vocabulary", "W-LR. Lexical Resource"),
  "W1-L3": def("writing", "lexical", "W1. Lexical Errors", "Collocation Error", "W-LR. Lexical Resource"),
  // Legacy compatibility: existing writing prompt can emit W1-C1..W1-C4
  "W1-C1": def("writing", "coherence", "W1. Coherence", "Weak Sentence Linking", "W-CC. Coherence & Cohesion"),
  "W1-C2": def("writing", "coherence", "W1. Coherence", "Incorrect Linking Word", "W-CC. Coherence & Cohesion"),
  "W1-C3": def("writing", "coherence", "W1. Coherence", "Repetitive Cohesion Pattern", "W-CC. Coherence & Cohesion"),
  "W1-C4": def("writing", "coherence", "W1. Coherence", "Paragraphing Issue", "W-CC. Coherence & Cohesion"),
  "W2-T1": def("writing", "task_response", "W2. Task Response", "Not Answering Question", "W-TR. Task Response / Achievement"),
  "W2-T2": def("writing", "task_response", "W2. Task Response", "Missing Position", "W-TR. Task Response / Achievement"),
  "W2-T3": def("writing", "task_response", "W2. Task Response", "Weak Argument", "W-TR. Task Response / Achievement"),
  "W2-T4": def("writing", "task_response", "W2. Task Response", "Off-topic", "W-TR. Task Response / Achievement"),
  "W2-C1": def("writing", "coherence", "W2. Coherence", "Poor Paragraphing", "W-CC. Coherence & Cohesion"),
  "W2-C2": def("writing", "coherence", "W2. Coherence", "Weak Linking", "W-CC. Coherence & Cohesion"),
  "W2-C3": def("writing", "coherence", "W2. Coherence", "Idea Jump", "W-CC. Coherence & Cohesion"),
  "W2-G1": def("writing", "grammar", "W2. Grammar", "Complex Sentence Error", "W-GRA. Grammatical Range & Accuracy"),
  "W2-G2": def("writing", "grammar", "W2. Grammar", "Fragment Sentence", "W-GRA. Grammatical Range & Accuracy"),
  "W2-G3": def("writing", "grammar", "W2. Grammar", "Run-on Sentence", "W-GRA. Grammatical Range & Accuracy"),
  "W2-L1": def("writing", "lexical", "W2. Lexical", "Word Choice Inaccuracy", "W-LR. Lexical Resource"),
  "W2-L2": def("writing", "lexical", "W2. Lexical", "Collocation Error", "W-LR. Lexical Resource"),
  "W2-L3": def("writing", "lexical", "W2. Lexical", "Overgeneralization", "W-LR. Lexical Resource"),
  "W-UNCLASSIFIED": def("writing", "unclassified", "Z. Unclassified", "Unclassified writing error", "W-TR. Task Response / Achievement"),
};

const SPEAKING_CODES = {
  "S-F1": def("speaking", "fluency_coherence", "S. Fluency & Coherence", "Excessive Pause", "S-FC. Fluency & Coherence"),
  "S-F2": def("speaking", "fluency_coherence", "S. Fluency & Coherence", "Filler Overuse", "S-FC. Fluency & Coherence"),
  "S-F3": def("speaking", "fluency_coherence", "S. Fluency & Coherence", "Self-correction Overuse", "S-FC. Fluency & Coherence"),
  "S-F4": def("speaking", "fluency_coherence", "S. Fluency & Coherence", "Disorganized Idea", "S-FC. Fluency & Coherence"),
  "S-L1": def("speaking", "lexical", "S. Lexical Resource", "Repetition", "S-LR. Lexical Resource"),
  "S-L2": def("speaking", "lexical", "S. Lexical Resource", "Incorrect Word Form", "S-LR. Lexical Resource"),
  "S-L3": def("speaking", "lexical", "S. Lexical Resource", "Limited Vocabulary", "S-LR. Lexical Resource"),
  "S-L4": def("speaking", "lexical", "S. Lexical Resource", "Misused Collocation", "S-LR. Lexical Resource"),
  "S-G1": def("speaking", "grammar", "S. Grammar", "Tense Error", "S-GRA. Grammatical Range & Accuracy"),
  "S-G2": def("speaking", "grammar", "S. Grammar", "Agreement Error", "S-GRA. Grammatical Range & Accuracy"),
  "S-G3": def("speaking", "grammar", "S. Grammar", "Simple Sentence Overuse", "S-GRA. Grammatical Range & Accuracy"),
  "S-G4": def("speaking", "grammar", "S. Grammar", "Structure Breakdown", "S-GRA. Grammatical Range & Accuracy"),
  "S-P1": def("speaking", "pronunciation", "S. Pronunciation", "Word Stress Error", "S-PR. Pronunciation"),
  "S-P2": def("speaking", "pronunciation", "S. Pronunciation", "Sentence Stress Error", "S-PR. Pronunciation"),
  "S-P3": def("speaking", "pronunciation", "S. Pronunciation", "Sound Substitution", "S-PR. Pronunciation"),
  "S-P4": def("speaking", "pronunciation", "S. Pronunciation", "Intonation Flat", "S-PR. Pronunciation"),
  "S-UNCLASSIFIED": def("speaking", "unclassified", "Z. Unclassified", "Unclassified speaking error", "S-FC. Fluency & Coherence"),
};

export const ERROR_CODE_DEFINITIONS = Object.freeze({
  ...READING_CODES,
  ...LISTENING_CODES,
  ...WRITING_CODES,
  ...SPEAKING_CODES,
});

const LEGACY_ERROR_CODE_DEFINITIONS = Object.freeze({
  ...LEGACY_LISTENING_CODES,
});

export const TAXONOMY = Object.freeze({
  reading: Object.freeze({
    core_cognitive_skills: readingCoreSkills,
    question_types: [
      "note_completion",
      "summary_completion",
      "sentence_completion",
      "table_completion",
      "flow_chart_completion",
      "matching_headings",
      "matching_information",
      "matching_features",
      "true_false_not_given",
      "yes_no_not_given",
      "multiple_choice",
      "short_answer",
    ],
  }),
  listening: Object.freeze({
    core_cognitive_skills: listeningCoreSkills,
    question_types: [
      "note_completion",
      "form_completion",
      "table_completion",
      "flow_chart_completion",
      "map_labeling",
      "multiple_choice",
      "short_answer",
      "sentence_completion",
      "summary_completion",
    ],
  }),
  writing: Object.freeze({
    core_cognitive_skills: writingCoreSkills,
    question_types: ["task1", "task2"],
  }),
  speaking: Object.freeze({
    core_cognitive_skills: speakingCoreSkills,
    question_types: ["part1", "part2", "part3"],
  }),
});

const QUESTION_TYPE_ALIASES = {
  true_false_notgiven: "true_false_not_given",
  yes_no_notgiven: "yes_no_not_given",
  tfng: "true_false_not_given",
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
  diagram_label_completion: "diagram_completion",
  matching_info: "matching_information",
  matching_heading: "matching_headings",
  multiple_choice_single: "multiple_choice",
  multiple_choice_multi: "multiple_choice",
  mult_choice: "multiple_choice",
  mult_choice_multi: "multiple_choice",
};

const DEFAULT_COGNITIVE_BY_QUESTION_TYPE = {
  reading: {
    true_false_not_given: "R4. Logical Relationship",
    yes_no_not_given: "R4. Logical Relationship",
    matching_headings: "R3. Inference",
    matching_information: "R5. Skimming / Scanning",
    matching_features: "R2. Paraphrase Recognition",
    multiple_choice: "R3. Inference",
    note_completion: "R1. Literal Comprehension",
    sentence_completion: "R1. Literal Comprehension",
    summary_completion: "R2. Paraphrase Recognition",
    table_completion: "R1. Literal Comprehension",
    flow_chart_completion: "R4. Logical Relationship",
    short_answer: "R5. Skimming / Scanning",
    diagram_completion: "R5. Skimming / Scanning",
  },
  listening: {
    note_completion: "L4. Number & Spelling Accuracy",
    sentence_completion: "L3. Connected Speech Recognition",
    summary_completion: "L3. Connected Speech Recognition",
    table_completion: "L4. Number & Spelling Accuracy",
    flow_chart_completion: "L5. Attention Tracking",
    map_labeling: "L2. Word Boundary Detection",
    short_answer: "L4. Number & Spelling Accuracy",
    multiple_choice: "L5. Attention Tracking",
  },
  writing: {
    task1: "W-TR. Task Response / Achievement",
    task2: "W-TR. Task Response / Achievement",
  },
  speaking: {
    part1: "S-FC. Fluency & Coherence",
    part2: "S-FC. Fluency & Coherence",
    part3: "S-FC. Fluency & Coherence",
    speaking: "S-FC. Fluency & Coherence",
  },
};

const FALLBACK_CODE_BY_SKILL = {
  reading: "R-UNCLASSIFIED",
  listening: "L-UNCLASSIFIED",
  writing: "W-UNCLASSIFIED",
  speaking: "S-UNCLASSIFIED",
};

const LISTENING_ALLOWED_CODES_BY_QUESTION_TYPE = Object.freeze({
  multiple_choice: Object.freeze(["L-C4", "L-C5", "L-C6", "L-K1", "L-K2", "L-K3"]),
  map_labeling: Object.freeze(["L-C2", "L-C4", "L-C5", "L-C6", "L-K1", "L-K2", "L-K3"]),
});

export const normalizeErrorCode = (errorCode) => String(errorCode || "").trim().toUpperCase();

export const normalizeSkillDomain = (skill) => {
  const normalized = String(skill || "").trim().toLowerCase();
  if (normalized === "reading" || normalized === "listening" || normalized === "writing" || normalized === "speaking") {
    return normalized;
  }
  return null;
};

export const normalizeQuestionType = (questionType) => {
  const raw = String(questionType || "unknown").trim().toLowerCase();
  const base = raw.replace(/[\s-]+/g, "_");
  return QUESTION_TYPE_ALIASES[base] || base;
};

export const getErrorCodeMeta = (errorCode) => {
  const normalizedCode = normalizeErrorCode(errorCode);
  return ERROR_CODE_DEFINITIONS[normalizedCode] || LEGACY_ERROR_CODE_DEFINITIONS[normalizedCode] || null;
};

export const getFallbackErrorCode = (skillDomain) => FALLBACK_CODE_BY_SKILL[normalizeSkillDomain(skillDomain)] || "R-UNCLASSIFIED";

export const isValidErrorCodeForSkill = (errorCode, skillDomain) => {
  const meta = getErrorCodeMeta(errorCode);
  return Boolean(meta && meta.skill === normalizeSkillDomain(skillDomain));
};

export const listErrorCodesForSkill = (skillDomain) => {
  const normalizedSkill = normalizeSkillDomain(skillDomain);
  if (!normalizedSkill) return [];
  return Object.entries(ERROR_CODE_DEFINITIONS)
    .filter(([, value]) => value.skill === normalizedSkill)
    .map(([key]) => key)
    .sort();
};

export const listErrorCodesForSkillAndQuestionType = (skillDomain, questionType) => {
  const normalizedSkill = normalizeSkillDomain(skillDomain);
  if (!normalizedSkill) return [];

  const allCodes = listErrorCodesForSkill(normalizedSkill);
  if (normalizedSkill !== "listening") return allCodes;

  const withoutLegacy = allCodes.filter((code) => !/^L-T\d+$/i.test(code));
  const canonicalType = normalizeQuestionType(questionType);
  const allowedByType = LISTENING_ALLOWED_CODES_BY_QUESTION_TYPE[canonicalType];
  if (!allowedByType || allowedByType.length === 0) return withoutLegacy;

  const allowedSet = new Set(allowedByType);
  return withoutLegacy.filter((code) => allowedSet.has(code));
};

export const resolveCognitiveSkill = ({ skillDomain, questionType, errorCode }) => {
  const normalizedSkill = normalizeSkillDomain(skillDomain);
  const meta = getErrorCodeMeta(errorCode);
  if (meta?.cognitiveSkill) return meta.cognitiveSkill;

  const canonicalQuestionType = normalizeQuestionType(questionType);
  const byQuestionType = DEFAULT_COGNITIVE_BY_QUESTION_TYPE[normalizedSkill];
  if (byQuestionType?.[canonicalQuestionType]) return byQuestionType[canonicalQuestionType];

  const skillConfig = TAXONOMY[normalizedSkill];
  return skillConfig?.core_cognitive_skills?.[0] || "General";
};

const normalizeSecondaryCodes = ({ secondaryErrorCodes, primaryCode, skillDomain }) =>
  (Array.isArray(secondaryErrorCodes) ? secondaryErrorCodes : [])
    .map((code) => normalizeErrorCode(code))
    .filter((code) => code && code !== primaryCode && isValidErrorCodeForSkill(code, skillDomain));

const clampConfidence = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(1, num));
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
  const normalizedSkill = normalizeSkillDomain(skillDomain)
    || getErrorCodeMeta(errorCode)?.skill
    || "reading";
  const canonicalType = normalizeQuestionType(questionType || taskType || "unknown");
  const normalizedCode = normalizeErrorCode(errorCode);
  const primaryCode = isValidErrorCodeForSkill(normalizedCode, normalizedSkill)
    ? normalizedCode
    : getFallbackErrorCode(normalizedSkill);
  const meta = getErrorCodeMeta(primaryCode);

  return {
    task_type: canonicalType,
    question_type: canonicalType,
    cognitive_skill: cognitiveSkill || meta?.cognitiveSkill || resolveCognitiveSkill({
      skillDomain: normalizedSkill,
      questionType: canonicalType,
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
