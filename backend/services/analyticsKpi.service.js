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

export const average = (items = []) => {
  const nums = items.filter((value) => Number.isFinite(Number(value))).map(Number);
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
};

export const roundHalf = (value) => Math.round(Number(value || 0) * 2) / 2;
export const roundOne = (value) => Math.round(Number(value || 0) * 10) / 10;

export const toBandScore = (correctCount, type) => {
  const numeric = Number(correctCount);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  const map = type === "listening" ? LISTENING_BAND_MAP : READING_BAND_MAP;
  const hit = map.find((item) => numeric >= item.min);
  return hit ? hit.band : 0;
};

export const parseObjectiveAttempt = ({ score, total, percentage, type }) => {
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

export const monthKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const monthLabel = (key) => {
  const [year, month] = String(key || "").split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleString("en-US", { month: "short" });
};

export const getRecentMonthKeys = (count = 7) => {
  const now = new Date();
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(date));
  }
  return out;
};

export const buildAnalyticsHistoryRaw = ({ attempts = [], writingSubmissions = [], speakingSessions = [] } = {}) => {
  const readingHistoryRaw = attempts
    .filter((item) => item?.type === "reading")
    .map((item) => ({
      type: "reading",
      score: parseObjectiveAttempt({
        score: item?.score,
        total: item?.total,
        percentage: item?.percentage,
        type: "reading",
      }).band,
      date: item?.submitted_at,
    }));

  const listeningHistoryRaw = attempts
    .filter((item) => item?.type === "listening")
    .map((item) => ({
      type: "listening",
      score: parseObjectiveAttempt({
        score: item?.score,
        total: item?.total,
        percentage: item?.percentage,
        type: "listening",
      }).band,
      date: item?.submitted_at,
    }));

  const writingHistoryRaw = writingSubmissions
    .filter((item) => Number.isFinite(Number(item?.score)))
    .map((item) => ({
      type: "writing",
      score: Number(item?.score || 0),
      date: item?.submitted_at,
    }));

  const speakingHistoryRaw = speakingSessions
    .filter((item) => Number.isFinite(Number(item?.analysis?.band_score)))
    .map((item) => ({
      type: "speaking",
      score: Number(item?.analysis?.band_score || 0),
      date: item?.timestamp,
    }));

  return {
    readingHistoryRaw,
    listeningHistoryRaw,
    writingHistoryRaw,
    speakingHistoryRaw,
    allHistoryRaw: [
      ...readingHistoryRaw,
      ...listeningHistoryRaw,
      ...writingHistoryRaw,
      ...speakingHistoryRaw,
    ],
  };
};

export const buildAnalyticsProgressHistory = ({ allHistoryRaw = [], recentMonthCount = 7 } = {}) => {
  const recentMonthKeys = getRecentMonthKeys(recentMonthCount);
  const monthBuckets = recentMonthKeys.reduce((acc, key) => {
    acc[key] = { Reading: [], Writing: [], Listening: [], Speaking: [] };
    return acc;
  }, {});

  allHistoryRaw.forEach((item) => {
    const key = monthKey(item?.date);
    if (!key || !monthBuckets[key]) return;

    if (item?.type === "reading") monthBuckets[key].Reading.push(item?.score);
    if (item?.type === "writing") monthBuckets[key].Writing.push(item?.score);
    if (item?.type === "listening") monthBuckets[key].Listening.push(item?.score);
    if (item?.type === "speaking") monthBuckets[key].Speaking.push(item?.score);
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

  return { progressHistory, recentMonthKeys };
};

export const buildAnalyticsSummary = ({ attempts = [], allHistoryRaw = [], recentMonthCount = 7 } = {}) => {
  const { progressHistory, recentMonthKeys } = buildAnalyticsProgressHistory({
    allHistoryRaw,
    recentMonthCount,
  });

  const overallValues = progressHistory
    .map((item) => item.overall)
    .filter((value) => Number.isFinite(Number(value)));

  const overallBand = overallValues.length ? roundHalf(overallValues[overallValues.length - 1]) : 0;
  const firstOverall = overallValues.length ? Number(overallValues[0]) : 0;
  const improvement = roundOne(overallBand - firstOverall);

  const thisMonthKey = recentMonthKeys[recentMonthKeys.length - 1];
  const thisMonthEvents = allHistoryRaw.filter((item) => monthKey(item?.date) === thisMonthKey).length;
  const totalAssessments = allHistoryRaw.length;

  const totalStudyHours = roundOne(
    attempts.reduce((sum, item) => sum + (Number(item?.time_taken_ms || 0) / 3600000), 0),
  );
  const thisMonthStudyHours = roundOne(
    attempts
      .filter((item) => monthKey(item?.submitted_at) === thisMonthKey)
      .reduce((sum, item) => sum + (Number(item?.time_taken_ms || 0) / 3600000), 0),
  );

  return {
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
    thisMonthEvents,
    thisMonthStudyHours,
  };
};
