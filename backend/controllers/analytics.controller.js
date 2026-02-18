import TestAttempt from "../models/TestAttempt.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import mongoose from "mongoose";

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

const formatQuestionType = (type = "") =>
  String(type || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

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
      .select("type score submitted_at time_taken_ms")
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
      {
        $project: {
          _id: 1,
          totalQuestions: 1,
          accuracy: {
            $multiply: [{ $divide: ["$correctQuestions", "$totalQuestions"] }, 100],
          },
        },
      },
      { $sort: { accuracy: 1 } },
      { $limit: 6 },
    ]),
  ]);

  const readingHistoryRaw = attempts
    .filter((item) => item.type === "reading")
    .map((item) => ({
      type: "reading",
      score: toBandScore(item.score, "reading"),
      date: item.submitted_at,
    }));

  const listeningHistoryRaw = attempts
    .filter((item) => item.type === "listening")
    .map((item) => ({
      type: "listening",
      score: toBandScore(item.score, "listening"),
      date: item.submitted_at,
    }));

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

  const readingBand = roundHalf(average(readingHistoryRaw.map((item) => item.score)));
  const listeningBand = roundHalf(average(listeningHistoryRaw.map((item) => item.score)));
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

  const weaknesses = weaknessRows.map((item) => ({
    category: formatQuestionType(item._id || "unknown"),
    score: roundOne(item.accuracy || 0),
    fullMark: 100,
    total: Number(item.totalQuestions || 0),
    rawType: item._id || "unknown",
  }));

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
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json(payload);
  } catch (error) {
    console.error("Analytics dashboard error:", error);
    return sendAnalyticsError(res, error);
  }
};

export const getAdminStudentAnalyticsDashboard = async (req, res) => {
  try {
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
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json({ skills: payload.skills });
  } catch (error) {
    return sendAnalyticsError(res, error);
  }
};

export const getWeaknessAnalysis = async (req, res) => {
  try {
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json({ weaknesses: payload.legacyWeaknesses });
  } catch (error) {
    return sendAnalyticsError(res, error);
  }
};

export const getProgressHistory = async (req, res) => {
  try {
    const payload = await buildAnalyticsPayload(req.user.userId);
    return res.json({ history: payload.history });
  } catch (error) {
    return sendAnalyticsError(res, error);
  }
};

export const getStudentAnalytics = async (req, res) => {
  try {
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
