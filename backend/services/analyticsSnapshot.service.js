import mongoose from "mongoose";
import TestAttempt from "../models/TestAttempt.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import AnalyticsSnapshot from "../models/AnalyticsSnapshot.model.js";

const SNAPSHOT_VERSION = 1;
const OBJECTIVE_TYPES = ["reading", "listening"];

const canonicalQuestionType = (rawType = "") => {
  const type = String(rawType || "unknown").toLowerCase();
  const completionTypes = new Set([
    "gap_fill",
    "note_completion",
    "summary_completion",
    "sentence_completion",
    "form_completion",
    "table_completion",
    "flow_chart_completion",
    "diagram_label_completion",
  ]);

  if (completionTypes.has(type)) return "note_completion";
  if (type === "matching_info") return "matching_information";
  if (type === "true_false_notgiven" || type === "true_false_not_given" || type === "tfng") return "tfng";
  if (type === "yes_no_notgiven" || type === "yes_no_not_given" || type === "ynng") return "ynng";
  if (type === "mult_choice" || type === "multiple_choice_single" || type === "multiple_choice_multi" || type === "mult_choice_multi") {
    return "multiple_choice";
  }

  return type;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNumericOrNull = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const ensureEntriesObject = (value) => (isObject(value) ? value : {});

const hasStrongerWatermark = (candidate, current) => {
  const next = toDateOrNull(candidate);
  if (!next) return false;
  const prev = toDateOrNull(current);
  if (!prev) return true;
  return next > prev;
};

const buildWeaknessByType = (detailedAnswers = []) => {
  const rows = Array.isArray(detailedAnswers) ? detailedAnswers : [];
  const out = {};

  rows.forEach((row) => {
    const canonical = canonicalQuestionType(row?.question_type || "unknown");
    if (!out[canonical]) {
      out[canonical] = { totalQuestions: 0, correctQuestions: 0 };
    }
    out[canonical].totalQuestions += 1;
    if (row?.is_correct === true) out[canonical].correctQuestions += 1;
  });

  return out;
};

const buildAttemptEntry = (doc = {}) => ({
  type: String(doc?.type || ""),
  score: toNumericOrNull(doc?.score),
  total: toNumericOrNull(doc?.total),
  percentage: toNumericOrNull(doc?.percentage),
  submitted_at: toDateOrNull(doc?.submitted_at),
  time_taken_ms: toNumericOrNull(doc?.time_taken_ms),
  weakness_by_type: buildWeaknessByType(doc?.detailed_answers),
});

const buildWritingEntry = (doc = {}) => ({
  score: toNumericOrNull(doc?.score),
  submitted_at: toDateOrNull(doc?.submitted_at || doc?.createdAt),
});

const buildSpeakingEntry = (doc = {}) => ({
  score: toNumericOrNull(doc?.analysis?.band_score),
  submitted_at: toDateOrNull(doc?.timestamp || doc?.createdAt),
});

const countSnapshotEntries = (entries = {}) => Object.keys(ensureEntriesObject(entries)).length;

const getOrCreateSnapshot = async (userId) => {
  const now = new Date();
  const snapshot = await AnalyticsSnapshot.findOneAndUpdate(
    { user_id: userId },
    {
      $setOnInsert: {
        user_id: userId,
        version: SNAPSHOT_VERSION,
        attempts_entries: {},
        writing_entries: {},
        speaking_entries: {},
        watermarks: {
          attempts_updated_at: null,
          writings_updated_at: null,
          speakings_updated_at: null,
        },
        refreshed_at: now,
      },
    },
    { upsert: true, new: true },
  );

  if (snapshot.version !== SNAPSHOT_VERSION) {
    snapshot.version = SNAPSHOT_VERSION;
    snapshot.attempts_entries = {};
    snapshot.writing_entries = {};
    snapshot.speaking_entries = {};
    snapshot.watermarks = {
      attempts_updated_at: null,
      writings_updated_at: null,
      speakings_updated_at: null,
    };
    snapshot.markModified("attempts_entries");
    snapshot.markModified("writing_entries");
    snapshot.markModified("speaking_entries");
    snapshot.markModified("watermarks");
    await snapshot.save();
  }

  return snapshot;
};

const refreshAttemptDelta = async (snapshot, userId) => {
  const since = toDateOrNull(snapshot?.watermarks?.attempts_updated_at);
  const query = {
    user_id: userId,
    type: { $in: OBJECTIVE_TYPES },
    score: { $ne: null },
  };
  if (since) query.updatedAt = { $gt: since };

  const docs = await TestAttempt.find(query)
    .select("_id type score total percentage submitted_at time_taken_ms detailed_answers updatedAt")
    .sort({ updatedAt: 1 })
    .lean();

  if (docs.length === 0) return false;

  const entries = ensureEntriesObject(snapshot.attempts_entries);
  let watermark = since;
  docs.forEach((doc) => {
    entries[String(doc._id)] = buildAttemptEntry(doc);
    if (hasStrongerWatermark(doc?.updatedAt, watermark)) watermark = toDateOrNull(doc?.updatedAt);
  });

  snapshot.attempts_entries = entries;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    attempts_updated_at: watermark || snapshot?.watermarks?.attempts_updated_at || null,
  };
  snapshot.markModified("attempts_entries");
  snapshot.markModified("watermarks");
  return true;
};

const refreshWritingDelta = async (snapshot, userId) => {
  const since = toDateOrNull(snapshot?.watermarks?.writings_updated_at);
  const query = {
    user_id: userId,
    status: { $in: ["scored", "reviewed"] },
    score: { $ne: null },
  };
  if (since) query.updatedAt = { $gt: since };

  const docs = await WritingSubmission.find(query)
    .select("_id score submitted_at createdAt updatedAt")
    .sort({ updatedAt: 1 })
    .lean();

  if (docs.length === 0) return false;

  const entries = ensureEntriesObject(snapshot.writing_entries);
  let watermark = since;
  docs.forEach((doc) => {
    entries[String(doc._id)] = buildWritingEntry(doc);
    if (hasStrongerWatermark(doc?.updatedAt, watermark)) watermark = toDateOrNull(doc?.updatedAt);
  });

  snapshot.writing_entries = entries;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    writings_updated_at: watermark || snapshot?.watermarks?.writings_updated_at || null,
  };
  snapshot.markModified("writing_entries");
  snapshot.markModified("watermarks");
  return true;
};

const refreshSpeakingDelta = async (snapshot, userId) => {
  const since = toDateOrNull(snapshot?.watermarks?.speakings_updated_at);
  const query = {
    userId: userId,
    status: "completed",
    "analysis.band_score": { $ne: null },
  };
  if (since) query.updatedAt = { $gt: since };

  const docs = await SpeakingSession.find(query)
    .select("_id analysis.band_score timestamp createdAt updatedAt")
    .sort({ updatedAt: 1 })
    .lean();

  if (docs.length === 0) return false;

  const entries = ensureEntriesObject(snapshot.speaking_entries);
  let watermark = since;
  docs.forEach((doc) => {
    entries[String(doc._id)] = buildSpeakingEntry(doc);
    if (hasStrongerWatermark(doc?.updatedAt, watermark)) watermark = toDateOrNull(doc?.updatedAt);
  });

  snapshot.speaking_entries = entries;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    speakings_updated_at: watermark || snapshot?.watermarks?.speakings_updated_at || null,
  };
  snapshot.markModified("speaking_entries");
  snapshot.markModified("watermarks");
  return true;
};

const rebuildAttemptsCollection = async (snapshot, userId) => {
  const docs = await TestAttempt.find({
    user_id: userId,
    type: { $in: OBJECTIVE_TYPES },
    score: { $ne: null },
  })
    .select("_id type score total percentage submitted_at time_taken_ms detailed_answers updatedAt")
    .lean();

  const entries = {};
  let watermark = null;
  docs.forEach((doc) => {
    entries[String(doc._id)] = buildAttemptEntry(doc);
    if (hasStrongerWatermark(doc?.updatedAt, watermark)) watermark = toDateOrNull(doc?.updatedAt);
  });

  snapshot.attempts_entries = entries;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    attempts_updated_at: watermark,
  };
  snapshot.markModified("attempts_entries");
  snapshot.markModified("watermarks");
};

const rebuildWritingsCollection = async (snapshot, userId) => {
  const docs = await WritingSubmission.find({
    user_id: userId,
    status: { $in: ["scored", "reviewed"] },
    score: { $ne: null },
  })
    .select("_id score submitted_at createdAt updatedAt")
    .lean();

  const entries = {};
  let watermark = null;
  docs.forEach((doc) => {
    entries[String(doc._id)] = buildWritingEntry(doc);
    if (hasStrongerWatermark(doc?.updatedAt, watermark)) watermark = toDateOrNull(doc?.updatedAt);
  });

  snapshot.writing_entries = entries;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    writings_updated_at: watermark,
  };
  snapshot.markModified("writing_entries");
  snapshot.markModified("watermarks");
};

const rebuildSpeakingsCollection = async (snapshot, userId) => {
  const docs = await SpeakingSession.find({
    userId: userId,
    status: "completed",
    "analysis.band_score": { $ne: null },
  })
    .select("_id analysis.band_score timestamp createdAt updatedAt")
    .lean();

  const entries = {};
  let watermark = null;
  docs.forEach((doc) => {
    entries[String(doc._id)] = buildSpeakingEntry(doc);
    if (hasStrongerWatermark(doc?.updatedAt, watermark)) watermark = toDateOrNull(doc?.updatedAt);
  });

  snapshot.speaking_entries = entries;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    speakings_updated_at: watermark,
  };
  snapshot.markModified("speaking_entries");
  snapshot.markModified("watermarks");
};

const maybeRebuildOnDrift = async (snapshot, userId) => {
  const [attemptCount, writingCount, speakingCount] = await Promise.all([
    TestAttempt.countDocuments({
      user_id: userId,
      type: { $in: OBJECTIVE_TYPES },
      score: { $ne: null },
    }),
    WritingSubmission.countDocuments({
      user_id: userId,
      status: { $in: ["scored", "reviewed"] },
      score: { $ne: null },
    }),
    SpeakingSession.countDocuments({
      userId: userId,
      status: "completed",
      "analysis.band_score": { $ne: null },
    }),
  ]);

  const currentAttemptEntries = countSnapshotEntries(snapshot.attempts_entries);
  const currentWritingEntries = countSnapshotEntries(snapshot.writing_entries);
  const currentSpeakingEntries = countSnapshotEntries(snapshot.speaking_entries);

  let rebuilt = false;
  if (currentAttemptEntries !== attemptCount) {
    await rebuildAttemptsCollection(snapshot, userId);
    rebuilt = true;
  }
  if (currentWritingEntries !== writingCount) {
    await rebuildWritingsCollection(snapshot, userId);
    rebuilt = true;
  }
  if (currentSpeakingEntries !== speakingCount) {
    await rebuildSpeakingsCollection(snapshot, userId);
    rebuilt = true;
  }

  return rebuilt;
};

const buildWeaknessRowsFromEntries = (attemptEntries = {}) => {
  const merged = {};
  Object.values(ensureEntriesObject(attemptEntries)).forEach((entry) => {
    const perAttempt = ensureEntriesObject(entry?.weakness_by_type);
    Object.entries(perAttempt).forEach(([questionType, value]) => {
      if (!merged[questionType]) {
        merged[questionType] = { totalQuestions: 0, correctQuestions: 0 };
      }

      const total = Number(value?.totalQuestions || 0);
      const correct = Number(value?.correctQuestions || 0);
      merged[questionType].totalQuestions += Number.isFinite(total) ? total : 0;
      merged[questionType].correctQuestions += Number.isFinite(correct) ? correct : 0;
    });
  });

  return Object.entries(merged).map(([key, value]) => ({
    _id: key,
    totalQuestions: value.totalQuestions,
    correctQuestions: value.correctQuestions,
  }));
};

const buildAttemptRowsFromEntries = (attemptEntries = {}) =>
  Object.values(ensureEntriesObject(attemptEntries)).map((entry) => ({
    type: entry?.type || "reading",
    score: toNumericOrNull(entry?.score),
    total: toNumericOrNull(entry?.total),
    percentage: toNumericOrNull(entry?.percentage),
    submitted_at: toDateOrNull(entry?.submitted_at),
    time_taken_ms: toNumericOrNull(entry?.time_taken_ms),
  }));

const buildWritingRowsFromEntries = (writingEntries = {}) =>
  Object.values(ensureEntriesObject(writingEntries)).map((entry) => ({
    score: toNumericOrNull(entry?.score),
    submitted_at: toDateOrNull(entry?.submitted_at),
  }));

const buildSpeakingRowsFromEntries = (speakingEntries = {}) =>
  Object.values(ensureEntriesObject(speakingEntries)).map((entry) => ({
    analysis: { band_score: toNumericOrNull(entry?.score) },
    timestamp: toDateOrNull(entry?.submitted_at),
  }));

export const loadAnalyticsSourceDataWithDelta = async (targetUserId) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    const error = new Error("Invalid user id");
    error.status = 400;
    throw error;
  }

  const objectId = new mongoose.Types.ObjectId(targetUserId);
  const snapshot = await getOrCreateSnapshot(objectId);

  const [attemptDelta, writingDelta, speakingDelta] = await Promise.all([
    refreshAttemptDelta(snapshot, objectId),
    refreshWritingDelta(snapshot, objectId),
    refreshSpeakingDelta(snapshot, objectId),
  ]);

  const rebuilt = await maybeRebuildOnDrift(snapshot, objectId);
  const changed = attemptDelta || writingDelta || speakingDelta || rebuilt;

  if (changed) {
    snapshot.refreshed_at = new Date();
    await snapshot.save();
  }

  return {
    attempts: buildAttemptRowsFromEntries(snapshot.attempts_entries),
    writingSubmissions: buildWritingRowsFromEntries(snapshot.writing_entries),
    speakingSessions: buildSpeakingRowsFromEntries(snapshot.speaking_entries),
    weaknessRows: buildWeaknessRowsFromEntries(snapshot.attempts_entries),
  };
};
