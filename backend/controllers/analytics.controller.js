import TestAttempt from "../models/TestAttempt.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import mongoose from "mongoose";
import OpenAI from "openai";
import dotenv from "dotenv";
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
const AI_INSIGHTS_CACHE_TTL_MS = 30 * 60 * 1000;
const AI_INSIGHTS_CACHE_MAX_ENTRIES = 200;
const aiInsightsCache = new Map();

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

const isCacheEntryFresh = (entry) => (
  entry &&
  Number.isFinite(entry.cachedAt) &&
  Date.now() - entry.cachedAt <= AI_INSIGHTS_CACHE_TTL_MS
);

const setCachedInsights = (key, value) => {
  aiInsightsCache.set(key, { cachedAt: Date.now(), value });
  while (aiInsightsCache.size > AI_INSIGHTS_CACHE_MAX_ENTRIES) {
    const oldestKey = aiInsightsCache.keys().next().value;
    aiInsightsCache.delete(oldestKey);
  }
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
  const parts = [
    log?.error_code ? `Ma loi: ${log.error_code}` : null,
    log?.error_category ? `Nhom: ${log.error_category}` : null,
    log?.cognitive_skill ? `Ky nang: ${log.cognitive_skill}` : null,
    log?.taxonomy_dimension ? `Dimension: ${log.taxonomy_dimension}` : null,
  ].filter(Boolean);

  if (parts.length === 0) return "Khong du du lieu de giai thich phan loai taxonomy.";
  return `${parts.join(" | ")}.`;
};

const normalizeErrorDetailsFilters = (query = {}) => ({
  errorCode: String(query.errorCode || query.code || "").trim().toUpperCase(),
  taskType: String(query.taskType || "").trim().toLowerCase(),
});

const filterErrorDetails = (details = [], query = {}) => {
  const { errorCode, taskType } = normalizeErrorDetailsFilters(query);
  if (!errorCode && !taskType) return details;

  return details.filter((item) => {
    const codeOk = !errorCode || String(item?.error_code || "").toUpperCase() === errorCode;
    const taskTypeOk = !taskType || String(item?.task_type || "").toLowerCase() === taskType;
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
  attempts.forEach(a => {
    if (a.error_logs) {
      a.error_logs.forEach(log => {
        errorLogs.push({ ...log, skill: a.type, logged_at: a.submitted_at });
      });
    }
  });

  // Writing
  const writings = await WritingSubmission.find({ user_id: userId, "error_logs.0": { $exists: true } })
    .sort({ created_at: -1 })
    .select("error_logs created_at")
    .lean();
  writings.forEach(w => {
    if (w.error_logs) {
      w.error_logs.forEach(log => {
        errorLogs.push({ ...log, skill: "writing", logged_at: w.created_at });
      });
    }
  });

  // Speaking
  const speakings = await SpeakingSession.find({ userId: userId, "error_logs.0": { $exists: true } })
    .sort({ createdAt: -1 })
    .select("error_logs timestamp")
    .lean();
  speakings.forEach(s => {
    if (s.error_logs) {
      s.error_logs.forEach(log => {
        errorLogs.push({ ...log, skill: "speaking", logged_at: s.timestamp });
      });
    }
  });

  return errorLogs;
}

async function aggregateUserErrorDetails(userId) {
  const details = [];

  const attempts = await TestAttempt.find({ user_id: userId, "error_logs.0": { $exists: true } })
    .sort({ submitted_at: -1 })
    .select("_id type test_id submitted_at error_logs")
    .lean();
  attempts.forEach((attemptDoc) => {
    (attemptDoc.error_logs || []).forEach((log, index) => {
      details.push({
        id: `attempt:${attemptDoc._id}:${index}`,
        source_type: "test_attempt",
        source_id: String(attemptDoc._id),
        source_label: "Test Attempt",
        source_ref: attemptDoc.test_id || null,
        skill: attemptDoc.type || "unknown",
        logged_at: attemptDoc.submitted_at,
        task_type: log.task_type || "unknown",
        task_type_label: formatQuestionType(log.task_type || "unknown"),
        question_number: log.question_number || null,
        error_code: log.error_code || "UNCLASSIFIED",
        error_category: log.error_category || "",
        cognitive_skill: log.cognitive_skill || "",
        taxonomy_dimension: log.taxonomy_dimension || "",
        detection_method: log.detection_method || "",
        taxonomy_version: log.taxonomy_version || "",
        confidence: Number.isFinite(Number(log.confidence)) ? Number(log.confidence) : null,
        text_snippet: log.text_snippet || "",
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
    (writingDoc.error_logs || []).forEach((log, index) => {
      details.push({
        id: `writing:${writingDoc._id}:${index}`,
        source_type: "writing_submission",
        source_id: String(writingDoc._id),
        source_label: "Writing Submission",
        source_ref: writingDoc.test_id || null,
        skill: "writing",
        logged_at: loggedAt,
        task_type: log.task_type || "unknown",
        task_type_label: formatQuestionType(log.task_type || "unknown"),
        question_number: log.question_number || null,
        error_code: log.error_code || "UNCLASSIFIED",
        error_category: log.error_category || "",
        cognitive_skill: log.cognitive_skill || "",
        taxonomy_dimension: log.taxonomy_dimension || "",
        detection_method: log.detection_method || "",
        taxonomy_version: log.taxonomy_version || "",
        confidence: Number.isFinite(Number(log.confidence)) ? Number(log.confidence) : null,
        text_snippet: log.text_snippet || "",
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
    (speakingDoc.error_logs || []).forEach((log, index) => {
      details.push({
        id: `speaking:${speakingDoc._id}:${index}`,
        source_type: "speaking_session",
        source_id: String(speakingDoc._id),
        source_label: "Speaking Session",
        source_ref: speakingDoc.questionId || null,
        skill: "speaking",
        logged_at: loggedAt,
        task_type: log.task_type || "unknown",
        task_type_label: formatQuestionType(log.task_type || "unknown"),
        question_number: log.question_number || null,
        error_code: log.error_code || "UNCLASSIFIED",
        error_category: log.error_category || "",
        cognitive_skill: log.cognitive_skill || "",
        taxonomy_dimension: log.taxonomy_dimension || "",
        detection_method: log.detection_method || "",
        taxonomy_version: log.taxonomy_version || "",
        confidence: Number.isFinite(Number(log.confidence)) ? Number(log.confidence) : null,
        text_snippet: log.text_snippet || "",
        user_answer: log.user_answer || "",
        correct_answer: log.correct_answer || "",
        explanation: log.explanation || "",
        taxonomy_reason: buildTaxonomyReason(log),
      });
    });
  });

  return details;
}

const READING_BAND_MAP = [
  { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
  { min: 32, band: 7.5 }, { min: 30, band: 7.0 }, { min: 26, band: 6.5 },
  { min: 23, band: 6.0 }, { min: 18, band: 5.5 }, { min: 16, band: 5.0 },
  { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
  { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
  { min: 1, band: 1.0 }, { min: 0, band: 0.0 },
];

const LISTENING_BAND_MAP = [
  { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
  { min: 33, band: 7.5 }, { min: 30, band: 7.0 }, { min: 27, band: 6.5 },
  { min: 23, band: 6.0 }, { min: 19, band: 5.5 }, { min: 15, band: 5.0 },
  { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
  { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
  { min: 1, band: 1.0 }, { min: 0, band: 0.0 },
];

const SKILL_LABELS = ["Reading", "Writing", "Listening", "Speaking"];
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

const average = (items = []) => {
  const nums = items.filter((v) => Number.isFinite(Number(v))).map(Number);
  if (!nums.length) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
};

const roundHalf = (value) => Math.round(Number(value || 0) * 2) / 2;
const roundOne = (value) => Math.round(Number(value || 0) * 10) / 10;

const toBandScore = (correctCount, type) => {
  const numeric = Number(correctCount);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  const map = type === "listening" ? LISTENING_BAND_MAP : READING_BAND_MAP;
  const hit = map.find((item) => numeric >= item.min);
  return hit ? hit.band : 0;
};

const parseObjectiveAttempt = ({ score, total, percentage, type }) => {
  const numericScore = Number(score);
  const numericTotal = Number(total);
  const numericPercentage = Number(percentage);

  if (
    Number.isFinite(numericScore) &&
    Number.isFinite(numericTotal) &&
    numericTotal > 0 &&
    numericScore >= 0 &&
    numericScore <= numericTotal
  ) {
    const scaledCorrect = (numericScore / numericTotal) * 40;
    return {
      band: toBandScore(scaledCorrect, type),
      weightedCorrect: numericScore,
      weightedTotal: numericTotal,
    };
  }

  if (Number.isFinite(numericPercentage) && numericPercentage >= 0) {
    const safePercentage = Math.min(100, numericPercentage);
    const scaledCorrect = (safePercentage / 100) * 40;
    return {
      band: toBandScore(scaledCorrect, type),
      weightedCorrect: scaledCorrect,
      weightedTotal: 40,
    };
  }

  if (Number.isFinite(numericScore) && numericScore >= 0 && numericScore <= 9) {
    return {
      band: numericScore,
      weightedCorrect: null,
      weightedTotal: null,
    };
  }

  const safeCorrect = Number.isFinite(numericScore) ? Math.max(0, numericScore) : 0;
  return {
    band: toBandScore(safeCorrect, type),
    weightedCorrect: safeCorrect,
    weightedTotal: 40,
  };
};

const monthKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const monthLabel = (key) => {
  const [year, month] = String(key || "").split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleString("en-US", { month: "short" });
};

const getRecentMonthKeys = (count = 7) => {
  const now = new Date();
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(date));
  }
  return out;
};

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
    tfng: "TRUE / FALSE / NOT GIVEN",
    ynng: "YES / NO / NOT GIVEN",
    multiple_choice: "Multiple Choice",
    note_completion: "Note Completion",
    matching_headings: "Matching Headings",
    matching_features: "Matching Features",
    matching_information: "Matching Information",
    matching_sentence_endings: "Matching Sentence Endings",
    matching: "Matching",
    short_answer: "Short Answer Questions",
    plan_map_diagram: "Plan / Map / Diagram Labeling",
    listening_map: "Listening Map Labeling",
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
  const readingHistoryRaw = attempts
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
  const listeningHistoryRaw = attempts
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

  const writingHistoryRaw = writingSubmissions.map((item) => ({
    type: "writing",
    score: Number(item.score || 0),
    date: item.submitted_at,
  }));

  const speakingHistoryRaw = speakingSessions.map((item) => ({
    type: "speaking",
    score: Number(item.analysis?.band_score || 0),
    date: item.timestamp,
  }));

  const readingBand = readingTotalWeighted > 0
    ? roundHalf(toBandScore((readingCorrectWeighted / readingTotalWeighted) * 40, "reading"))
    : roundHalf(average(readingLegacyBands.length ? readingLegacyBands : readingHistoryRaw.map((item) => item.score)));
  const listeningBand = listeningTotalWeighted > 0
    ? roundHalf(toBandScore((listeningCorrectWeighted / listeningTotalWeighted) * 40, "listening"))
    : roundHalf(average(listeningLegacyBands.length ? listeningLegacyBands : listeningHistoryRaw.map((item) => item.score)));
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

  const allHistoryRaw = [
    ...readingHistoryRaw,
    ...listeningHistoryRaw,
    ...writingHistoryRaw,
    ...speakingHistoryRaw,
  ];

  const recentMonthKeys = getRecentMonthKeys(7);
  const monthBuckets = recentMonthKeys.reduce((acc, key) => {
    acc[key] = { Reading: [], Writing: [], Listening: [], Speaking: [] };
    return acc;
  }, {});

  allHistoryRaw.forEach((item) => {
    const key = monthKey(item.date);
    if (!key || !monthBuckets[key]) return;

    if (item.type === "reading") monthBuckets[key].Reading.push(item.score);
    if (item.type === "writing") monthBuckets[key].Writing.push(item.score);
    if (item.type === "listening") monthBuckets[key].Listening.push(item.score);
    if (item.type === "speaking") monthBuckets[key].Speaking.push(item.score);
  });

  const carryForward = { Reading: null, Writing: null, Listening: null, Speaking: null };
  const progressHistory = recentMonthKeys.map((key) => {
    const row = { month: monthLabel(key) };

    SKILL_LABELS.forEach((label) => {
      const values = monthBuckets[key][label];
      if (values.length > 0) {
        carryForward[label] = roundHalf(average(values));
      }
      row[label] = carryForward[label];
    });

    const available = SKILL_LABELS
      .map((label) => row[label])
      .filter((value) => Number.isFinite(Number(value)));
    row.overall = available.length ? roundHalf(average(available)) : null;

    return row;
  });

  const overallValues = progressHistory
    .map((item) => item.overall)
    .filter((value) => Number.isFinite(Number(value)));

  const overallBand = overallValues.length ? roundHalf(overallValues[overallValues.length - 1]) : 0;
  const firstOverall = overallValues.length ? Number(overallValues[0]) : 0;
  const improvement = roundOne(overallBand - firstOverall);

  const thisMonthKey = recentMonthKeys[recentMonthKeys.length - 1];
  const thisMonthEvents = allHistoryRaw.filter((item) => monthKey(item.date) === thisMonthKey).length;
  const totalAssessments = allHistoryRaw.length;

  const totalStudyHours = roundOne(
    attempts.reduce((sum, item) => sum + (Number(item.time_taken_ms || 0) / 3600000), 0)
  );
  const thisMonthStudyHours = roundOne(
    attempts
      .filter((item) => monthKey(item.submitted_at) === thisMonthKey)
      .reduce((sum, item) => sum + (Number(item.time_taken_ms || 0) / 3600000), 0)
  );

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
    summary: {
      overallBand,
      testsTaken: totalAssessments,
      studyHours: totalStudyHours,
      improvement,
      changes: {
        overallBand: `${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)}`,
        testsTaken: `+${thisMonthEvents} this month`,
        studyHours: `+${thisMonthStudyHours.toFixed(1)}h this month`,
        improvement: "Since start",
      },
    },
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

const sendAnalyticsError = (res, error) => {
  const status = Number(error?.status || 500);
  const message = error?.message || "Failed to load analytics";
  return res.status(status).json({ message });
};

export const getAnalyticsDashboard = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json(payload);
  } catch (error) {
    console.error("Analytics dashboard error:", error);
    return sendAnalyticsError(res, error);
  }
};

export const getAdminStudentAnalyticsDashboard = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const payload = await buildAnalyticsPayload(req.params.studentId);
    return res.json(payload);
  } catch (error) {
    console.error("Admin analytics dashboard error:", error);
    return sendAnalyticsError(res, error);
  }
};

// Legacy endpoints retained for compatibility with older frontend calls.
export const getSkillsBreakdown = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json({ skills: payload.skills });
  } catch (error) {
    return sendAnalyticsError(res, error);
  }
};

export const getWeaknessAnalysis = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json({ weaknesses: payload.legacyWeaknesses });
  } catch (error) {
    return sendAnalyticsError(res, error);
  }
};

export const getProgressHistory = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json({ history: payload.history });
  } catch (error) {
    return sendAnalyticsError(res, error);
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
    return sendAnalyticsError(res, error);
  }
};

export const getErrorAnalytics = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const { userId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const filters = parseAnalyticsFilters(req.query);
    const errorLogs = filterErrorLogs(await aggregateUserErrors(userId), filters);

    // Grouping logic for Heatmap (Task Type vs Error Category) and Bar Charts (Cognitive Skill frequency)
    const taskTypeVsCategory = {}; // { 'TFNG': { 'R-C4': 5, 'R-C1': 2 } }
    const cognitiveSkillCount = {}; // { 'Literal Comprehension': 10 }
    const skillBreakdown = { reading: 0, listening: 0, writing: 0, speaking: 0 };
    const totalErrors = errorLogs.length;

    errorLogs.forEach(log => {
      if (log.skill && Object.prototype.hasOwnProperty.call(skillBreakdown, log.skill)) {
        skillBreakdown[log.skill]++;
      }

      // Heatmap Aggregation
      const tType = log.task_type || 'Unknown';
      const eCode = log.error_code || 'UNCLASSIFIED';
      if (!taskTypeVsCategory[tType]) taskTypeVsCategory[tType] = {};
      taskTypeVsCategory[tType][eCode] = (taskTypeVsCategory[tType][eCode] || 0) + 1;

      // Bar chart aggregation
      const cogSkill = log.cognitive_skill || 'General';
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
        cognitiveData
      }
    });

  } catch (error) {
    console.error("Error generating analytics:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getErrorAnalyticsDetails = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const { userId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
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
    console.error("Error generating analytics details:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAIInsights = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const { userId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
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
    const cacheKey = `${userId}|${filters.range}|${filters.skill}|${errorLogs.length}|${latestErrorMs}`;
    const cachedInsights = aiInsightsCache.get(cacheKey);
    if (isCacheEntryFresh(cachedInsights)) {
      return res.status(200).json({ success: true, data: cachedInsights.value });
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return valid JSON only. Use Vietnamese language." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const parsedInsights = JSON.parse(response.choices[0].message.content);
    const normalizedPayload = {
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

    setCachedInsights(cacheKey, normalizedPayload);
    return res.status(200).json({
      success: true,
      data: normalizedPayload,
    });
  } catch (error) {
    console.error("Error generating AI insights:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAdminStudentErrorAnalytics = async (req, res) => {
  try {
    const scopedReq = {
      ...req,
      user: {
        ...req.user,
        userId: req.params.studentId,
      },
    };
    return await getErrorAnalytics(scopedReq, res);
  } catch (error) {
    console.error("Error generating admin analytics:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAdminStudentErrorAnalyticsDetails = async (req, res) => {
  try {
    const scopedReq = {
      ...req,
      user: {
        ...req.user,
        userId: req.params.studentId,
      },
    };
    return await getErrorAnalyticsDetails(scopedReq, res);
  } catch (error) {
    console.error("Error generating admin analytics details:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAdminStudentAIInsights = async (req, res) => {
  try {
    const scopedReq = {
      ...req,
      user: {
        ...req.user,
        userId: req.params.studentId,
      },
    };
    return await getAIInsights(scopedReq, res);
  } catch (error) {
    console.error("Error generating admin AI insights:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
