import mongoose from "mongoose";
import Speaking from "../models/Speaking.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import Test from "../models/Test.model.js";
import TestAttempt from "../models/TestAttempt.model.js";
import Vocabulary from "../models/Vocabulary.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import { buildAnalyticsHistoryRaw, buildAnalyticsSummary } from "./analyticsKpi.service.js";

const SKILL_KEYS = Object.freeze(["reading", "listening", "writing", "speaking"]);
const WRITING_COMPLETED_STATUS = new Set(["scored", "reviewed"]);
const SPEAKING_COMPLETED_STATUS = new Set(["completed"]);
const DAY_MS = 24 * 60 * 60 * 1000;

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

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const roundHalf = (value) => Math.round(toNumber(value, 0) * 2) / 2;

const clampBand = (value) => {
  const numeric = toNumber(value, 0);
  return Math.max(0, Math.min(9, roundHalf(numeric)));
};

const average = (values = []) => {
  const numericValues = values
    .map((item) => toNumber(item, NaN))
    .filter((item) => Number.isFinite(item));

  if (!numericValues.length) return 0;
  return numericValues.reduce((sum, item) => sum + item, 0) / numericValues.length;
};

const toBandScore = (correctCount, skill) => {
  const numeric = toNumber(correctCount, -1);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;

  const map = skill === "listening" ? LISTENING_BAND_MAP : READING_BAND_MAP;
  const matched = map.find((item) => numeric >= item.min);
  return matched ? matched.band : 0;
};

const parseObjectiveBand = ({ score, total, percentage, skill }) => {
  const numericScore = toNumber(score, NaN);
  const numericTotal = toNumber(total, NaN);
  const numericPercentage = toNumber(percentage, NaN);

  if (
    Number.isFinite(numericScore) &&
    Number.isFinite(numericTotal) &&
    numericTotal > 0 &&
    numericScore >= 0 &&
    numericScore <= numericTotal
  ) {
    const scaledCorrect = (numericScore / numericTotal) * 40;
    return clampBand(toBandScore(scaledCorrect, skill));
  }

  if (Number.isFinite(numericPercentage) && numericPercentage >= 0) {
    const scaledCorrect = (Math.min(100, numericPercentage) / 100) * 40;
    return clampBand(toBandScore(scaledCorrect, skill));
  }

  if (Number.isFinite(numericScore) && numericScore >= 0 && numericScore <= 9) {
    return clampBand(numericScore);
  }

  return clampBand(toBandScore(Math.max(0, toNumber(numericScore, 0)), skill));
};

const normalizeTargets = (targets = {}) => ({
  reading: clampBand(targets.reading),
  listening: clampBand(targets.listening),
  writing: clampBand(targets.writing),
  speaking: clampBand(targets.speaking),
});

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const createEmptyDashboard = (targets = {}) => {
  const safeTargets = normalizeTargets(targets);
  const skills = {};

  SKILL_KEYS.forEach((skill) => {
    const band = safeTargets[skill];
    skills[skill] = {
      band,
      progressPct: Math.max(0, Math.min(100, Math.round((band / 9) * 100))),
    };
  });

  return {
    summary: {
      totalMockTests: 0,
      weeklyDelta: 0,
      averageBandScore: 0,
      averageBandDelta: 0,
      totalStudyHours: 0,
      remainingStudyHours: 0,
    },
    skills,
    badges: buildBadges({
      writingCount: 0,
      speakingCount: 0,
      vocabularyCount: 0,
      streakDays: 0,
      writingBand: 0,
    }),
    recentActivities: [],
  };
};

const dayKeyUtc = (value) => {
  const date = toDate(value);
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
};

const computeConsecutiveDays = (records = []) => {
  const uniqueDays = Array.from(
    new Set(records.map((item) => dayKeyUtc(item?.date)).filter(Boolean)),
  ).sort((a, b) => (a < b ? 1 : -1));

  if (!uniqueDays.length) return 0;
  let streak = 1;
  let cursor = new Date(`${uniqueDays[0]}T00:00:00.000Z`);

  for (let i = 1; i < uniqueDays.length; i += 1) {
    const next = new Date(`${uniqueDays[i]}T00:00:00.000Z`);
    const delta = Math.round((cursor.getTime() - next.getTime()) / DAY_MS);
    if (delta !== 1) break;
    streak += 1;
    cursor = next;
  }

  return streak;
};

const computeLatestSkillAverages = (completedRecords = [], targets = {}) => {
  const safeTargets = normalizeTargets(targets);
  const skillMap = Object.fromEntries(SKILL_KEYS.map((skill) => [skill, []]));

  completedRecords.forEach((item) => {
    if (!SKILL_KEYS.includes(item.skill)) return;
    skillMap[item.skill].push(item);
  });

  const skills = {};
  SKILL_KEYS.forEach((skill) => {
    const latestFive = skillMap[skill]
      .sort((a, b) => toNumber(toDate(b.date)?.getTime(), 0) - toNumber(toDate(a.date)?.getTime(), 0))
      .slice(0, 5);

    const band = latestFive.length
      ? roundHalf(average(latestFive.map((item) => item.score)))
      : safeTargets[skill];

    skills[skill] = {
      band,
      progressPct: Math.max(0, Math.min(100, Math.round((band / 9) * 100))),
    };
  });

  return skills;
};

const resolveWritingTaskName = (submission, testTitle = "") => {
  if (testTitle) return testTitle;

  const answerTitles = Array.isArray(submission?.writing_answers)
    ? submission.writing_answers
      .map((entry) => String(entry?.task_title || "").trim())
      .filter(Boolean)
    : [];

  if (!answerTitles.length) return "Writing Practice";
  if (answerTitles.length === 1) return answerTitles[0];
  return `${answerTitles[0]} +${answerTitles.length - 1} task(s)`;
};

const resolveSpeakingTaskName = (session, speakingInfo = null) => {
  if (speakingInfo?.title) {
    const part = Number(speakingInfo.part);
    if (Number.isFinite(part) && part > 0) {
      return `Speaking Part ${part}: ${speakingInfo.title}`;
    }
    return `Speaking: ${speakingInfo.title}`;
  }

  if (session?.questionId) return `Speaking ${String(session.questionId)}`;
  return "Speaking Practice";
};

const toActivityStatus = (completed) => (completed ? "completed" : "pending");

const buildBadges = ({ writingCount, speakingCount, vocabularyCount, streakDays, writingBand }) => {
  const writingLevel = writingCount > 0 ? Math.min(9, Math.max(1, Math.ceil(writingCount / 5))) : 0;
  const vocabularyLevel = vocabularyCount > 0 ? Math.min(9, Math.max(1, Math.ceil(vocabularyCount / 100))) : 0;
  const streakLevel = streakDays > 0 ? Math.min(9, Math.max(1, Math.ceil(streakDays / 7))) : 0;
  const speakingLevel = speakingCount > 0 ? Math.min(9, Math.max(1, Math.ceil(speakingCount / 5))) : 0;
  const grammarUnlocked = writingCount >= 5 && writingBand >= 7.5;

  return [
    {
      key: "writing_warrior",
      unlocked: writingCount >= 1,
      level: writingLevel,
      subtitle: `Submitted ${writingCount} essay${writingCount === 1 ? "" : "s"}`,
    },
    {
      key: "vocab_master",
      unlocked: vocabularyCount >= 100,
      level: vocabularyLevel,
      subtitle: `Learned ${vocabularyCount} words`,
      tooltip: "Unlock at 100 saved words.",
    },
    {
      key: "streak_7_day",
      unlocked: streakDays >= 7,
      level: streakLevel,
      subtitle: `${streakDays}-day learning streak`,
      tooltip: "Practice 7 consecutive days to unlock.",
    },
    {
      key: "speaking_pro",
      unlocked: speakingCount >= 5,
      level: speakingLevel,
      subtitle: `Completed ${speakingCount} mock interviews`,
      tooltip: "Complete 5 speaking sessions to unlock.",
    },
    {
      key: "grammar_guru",
      unlocked: grammarUnlocked,
      level: grammarUnlocked ? 1 : 0,
      subtitle: grammarUnlocked ? "Strong writing grammar control" : "Reach Writing Band 7.5+ in 5 tests",
      tooltip: "Reach Writing Band 7.5+ in at least 5 scored submissions.",
    },
  ];
};

export const buildProfileDashboard = async (userId, { targets = {} } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return createEmptyDashboard(targets);
  }

  const objectId = new mongoose.Types.ObjectId(userId);

  const [objectiveAttempts, writingSubmissions, writingAttempts, speakingSessions, vocabularyCount] =
    await Promise.all([
      TestAttempt.find({
        user_id: objectId,
        type: { $in: ["reading", "listening"] },
        score: { $ne: null },
      })
        .select("_id test_id type score total percentage submitted_at time_taken_ms")
        .lean(),
      WritingSubmission.find({ user_id: objectId })
        .select("_id test_id attempt_id writing_answers.task_title score submitted_at status")
        .lean(),
      TestAttempt.find({
        user_id: objectId,
        type: "writing",
      })
        .select("_id test_id score total percentage submitted_at time_taken_ms")
        .lean(),
      SpeakingSession.find({ userId: objectId })
        .select("_id questionId analysis.band_score timestamp status")
        .lean(),
      Vocabulary.countDocuments({ user_id: String(userId) }),
    ]);

  const completedRecords = [];
  const activities = [];

  objectiveAttempts.forEach((attempt) => {
    const date = toDate(attempt?.submitted_at);
    if (!date) return;
    const skill = String(attempt?.type || "").toLowerCase();
    if (!["reading", "listening"].includes(skill)) return;

    const score = parseObjectiveBand({
      score: attempt?.score,
      total: attempt?.total,
      percentage: attempt?.percentage,
      skill,
    });
    const testIdRef = String(attempt?.test_id || "").trim();
    const attemptIdRef = String(attempt?._id || "").trim();
    const fallbackTitle = `${skill[0].toUpperCase()}${skill.slice(1)} Test`;
    const id = `attempt:${attemptIdRef}`;

    completedRecords.push({ id, skill, score, date });
    activities.push({
      id,
      taskName: fallbackTitle,
      testIdRef,
      attemptIdRef,
      type: skill,
      date,
      score,
      status: "completed",
    });

  });

  const writingSubmissionAttemptIds = new Set(
    writingSubmissions
      .map((item) => String(item?.attempt_id || "").trim())
      .filter(Boolean),
  );

  writingSubmissions.forEach((submission) => {
    const date = toDate(submission?.submitted_at);
    if (!date) return;

    const rawStatus = String(submission?.status || "").toLowerCase();
    const score = clampBand(submission?.score);
    const completed = WRITING_COMPLETED_STATUS.has(rawStatus) && Number.isFinite(Number(submission?.score));
    const taskName = resolveWritingTaskName(submission, "");
    const testIdRef = String(submission?.test_id || "").trim();
    const submissionIdRef = String(submission?._id || "").trim();
    const id = `writing_submission:${submissionIdRef}`;

    activities.push({
      id,
      taskName,
      testIdRef,
      submissionIdRef,
      type: "writing",
      date,
      score: completed ? score : null,
      status: toActivityStatus(completed),
    });

    if (completed) {
      completedRecords.push({
        id,
        skill: "writing",
        score,
        date,
      });
    }
  });

  writingAttempts.forEach((attempt) => {
    const attemptId = String(attempt?._id || "").trim();
    if (!attemptId || writingSubmissionAttemptIds.has(attemptId)) {
      return;
    }

    const date = toDate(attempt?.submitted_at);
    if (!date) return;

    const numericScore = Number(attempt?.score);
    const completed = Number.isFinite(numericScore);
    const score = completed
      ? clampBand(
        Number.isFinite(numericScore) && numericScore > 9
          ? parseObjectiveBand({
            score: attempt?.score,
            total: attempt?.total,
            percentage: attempt?.percentage,
            skill: "reading",
          })
          : numericScore,
      )
      : null;
    const testIdRef = String(attempt?.test_id || "").trim();
    const id = `writing_attempt:${attemptId}`;

    activities.push({
      id,
      taskName: "Writing Practice",
      testIdRef,
      attemptIdRef: attemptId,
      type: "writing",
      date,
      score,
      status: toActivityStatus(completed),
    });

    if (completed) {
      completedRecords.push({
        id,
        skill: "writing",
        score,
        date,
      });
    }
  });

  speakingSessions.forEach((session) => {
    const date = toDate(session?.timestamp);
    if (!date) return;

    const rawStatus = String(session?.status || "").toLowerCase();
    const score = clampBand(session?.analysis?.band_score);
    const completed = SPEAKING_COMPLETED_STATUS.has(rawStatus) && Number.isFinite(Number(session?.analysis?.band_score));
    const questionIdRef = String(session?.questionId || "").trim();
    const taskName = resolveSpeakingTaskName(session, null);
    const id = `speaking_session:${String(session?._id || "")}`;

    activities.push({
      id,
      taskName,
      questionIdRef,
      type: "speaking",
      date,
      score: completed ? score : null,
      status: toActivityStatus(completed),
    });

    if (completed) {
      completedRecords.push({
        id,
        skill: "speaking",
        score,
        date,
      });
    }
  });

  const canonicalWritingSubmissions = writingSubmissions.filter((submission) => {
    const rawStatus = String(submission?.status || "").toLowerCase();
    return WRITING_COMPLETED_STATUS.has(rawStatus) && Number.isFinite(Number(submission?.score));
  });
  const canonicalSpeakingSessions = speakingSessions.filter((session) => {
    const rawStatus = String(session?.status || "").toLowerCase();
    return SPEAKING_COMPLETED_STATUS.has(rawStatus) && Number.isFinite(Number(session?.analysis?.band_score));
  });
  const { allHistoryRaw } = buildAnalyticsHistoryRaw({
    attempts: objectiveAttempts,
    writingSubmissions: canonicalWritingSubmissions,
    speakingSessions: canonicalSpeakingSessions,
  });
  const analyticsSummary = buildAnalyticsSummary({
    attempts: objectiveAttempts,
    allHistoryRaw,
    recentMonthCount: 7,
  });

  const skills = computeLatestSkillAverages(completedRecords, targets);
  const summary = {
    totalMockTests: analyticsSummary.testsTaken,
    weeklyDelta: analyticsSummary.thisMonthEvents,
    averageBandScore: analyticsSummary.overallBand,
    averageBandDelta: analyticsSummary.improvement,
    totalStudyHours: analyticsSummary.studyHours,
    remainingStudyHours: analyticsSummary.thisMonthStudyHours,
  };
  const streakDays = computeConsecutiveDays(completedRecords);
  const writingCount = completedRecords.filter((item) => item.skill === "writing").length;
  const speakingCount = completedRecords.filter((item) => item.skill === "speaking").length;
  const writingBand = toNumber(skills?.writing?.band, 0);
  const badges = buildBadges({
    writingCount,
    speakingCount,
    vocabularyCount: Math.max(0, Math.round(toNumber(vocabularyCount, 0))),
    streakDays,
    writingBand,
  });

  const recentActivityCandidates = activities
    .filter((item) => toDate(item.date))
    .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime())
    .slice(0, 10);

  const recentTestIdSet = new Set(
    recentActivityCandidates.map((item) => String(item?.testIdRef || "").trim()).filter(Boolean),
  );
  const recentSpeakingQuestionIdSet = new Set(
    recentActivityCandidates.map((item) => String(item?.questionIdRef || "").trim()).filter(Boolean),
  );

  const [recentTests, recentSpeakingQuestions] = await Promise.all([
    recentTestIdSet.size
      ? Test.find({ _id: { $in: [...recentTestIdSet] } }).select("_id title").lean()
      : [],
    recentSpeakingQuestionIdSet.size
      ? Speaking.find({ _id: { $in: [...recentSpeakingQuestionIdSet] } }).select("_id title part").lean()
      : [],
  ]);

  const recentTestTitleMap = new Map(
    recentTests.map((item) => [String(item?._id || "").trim(), String(item?.title || "").trim()]),
  );
  const recentSpeakingQuestionMap = new Map(
    recentSpeakingQuestions.map((item) => [String(item?._id || "").trim(), item]),
  );

  const recentActivities = recentActivityCandidates
    .map((item) => ({
      id: item.id,
      taskName: (() => {
        const questionIdRef = String(item?.questionIdRef || "").trim();
        if (questionIdRef) {
          const speakingInfo = recentSpeakingQuestionMap.get(questionIdRef) || null;
          if (speakingInfo) {
            return resolveSpeakingTaskName({ questionId: questionIdRef }, speakingInfo);
          }
        }

        const testIdRef = String(item?.testIdRef || "").trim();
        const testTitle = testIdRef ? recentTestTitleMap.get(testIdRef) : "";
        if (!testTitle) return item.taskName;

        if (item.type === "reading" || item.type === "listening") {
          return testTitle;
        }
        if (item.type === "writing" && item.taskName === "Writing Practice") {
          return testTitle;
        }
        return item.taskName;
      })(),
      type: item.type,
      date: item.date,
      score: item.score,
      status: item.status,
      testId: String(item?.testIdRef || "").trim() || null,
      questionId: String(item?.questionIdRef || "").trim() || null,
      attemptId: String(item?.attemptIdRef || "").trim() || null,
      submissionId: String(item?.submissionIdRef || "").trim() || null,
    }));

  return {
    summary,
    skills,
    badges,
    recentActivities,
  };
};

export const sanitizeAvatarSeed = (value, fallback = "ielts-student") => {
  const raw = String(value ?? "").trim();
  const seed = raw || String(fallback || "ielts-student").trim();
  return seed.slice(0, 120);
};

export const sanitizeDisplayName = (value) => String(value ?? "").trim().slice(0, 120);

export const normalizeProfileTargets = (targets = {}, fallback = {}) =>
  normalizeTargets({
    ...normalizeTargets(fallback),
    ...(typeof targets === "object" && targets !== null ? targets : {}),
  });
