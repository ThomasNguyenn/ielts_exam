import mongoose from "mongoose";
import TestAttempt from "../models/TestAttempt.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import Test from "../models/Test.model.js";
import AnalyticsErrorSnapshot from "../models/AnalyticsErrorSnapshot.model.js";

const SNAPSHOT_VERSION = 1;
const OBJECTIVE_TYPES = ["reading", "listening"];
const MAX_DETAIL_SNIPPET_LENGTH = 500;

const toSafeErrorLogArray = (value) =>
  (Array.isArray(value) ? value : []).filter((item) => item && typeof item === "object");

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const ensureObject = (value) =>
  (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const ensureStringArray = (value) =>
  Array.isArray(value) ? value.map((item) => String(item || "")).filter(Boolean) : [];

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
    console.warn("[analytics:error-snapshot] Failed to build question snippet lookup:", error?.message || "Unknown error");
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

const buildEntryId = (prefix, docId, index) => `${prefix}:${docId}:${index}`;

const buildBaseEntry = ({
  id,
  sourceType,
  sourceId,
  sourceLabel,
  sourceRef,
  skill,
  loggedAt,
  log,
  fallbackSnippet = "",
}) => ({
  id,
  source_type: sourceType,
  source_id: String(sourceId || ""),
  source_label: sourceLabel,
  source_ref: sourceRef || null,
  skill: String(skill || "unknown").toLowerCase(),
  logged_at: loggedAt || null,
  task_type: log?.task_type || "unknown",
  question_number: log?.question_number || null,
  error_code: log?.error_code || "UNCLASSIFIED",
  error_label: log?.error_label || "",
  error_category: log?.error_category || "",
  cognitive_skill: log?.cognitive_skill || "",
  taxonomy_dimension: log?.taxonomy_dimension || "",
  detection_method: log?.detection_method || "",
  taxonomy_version: log?.taxonomy_version || "",
  confidence: Number.isFinite(Number(log?.confidence)) ? Number(log.confidence) : null,
  text_snippet: resolveDetailTextSnippet(log, fallbackSnippet),
  user_answer: log?.user_answer || "",
  correct_answer: log?.correct_answer || "",
  explanation: log?.explanation || "",
});

const updateDocEntries = ({
  entries,
  indexBucket,
  sourcePrefix,
  docId,
  builtEntries = [],
}) => {
  const safeDocId = String(docId || "");
  if (!safeDocId) return;

  const previousEntryIds = ensureStringArray(indexBucket?.[safeDocId]);
  previousEntryIds.forEach((entryId) => {
    delete entries[entryId];
  });
  delete indexBucket[safeDocId];

  if (!Array.isArray(builtEntries) || builtEntries.length === 0) return;

  const newEntryIds = [];
  builtEntries.forEach((entry, index) => {
    const entryId = entry?.id || buildEntryId(sourcePrefix, safeDocId, index);
    entries[entryId] = { ...entry, id: entryId };
    newEntryIds.push(entryId);
  });
  indexBucket[safeDocId] = newEntryIds;
};

const getOrCreateSnapshot = async (userId) => {
  const now = new Date();
  const snapshot = await AnalyticsErrorSnapshot.findOneAndUpdate(
    { user_id: userId },
    {
      $setOnInsert: {
        user_id: userId,
        version: SNAPSHOT_VERSION,
        entries: {},
        doc_index: {
          attempts: {},
          writings: {},
          speakings: {},
        },
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
    snapshot.entries = {};
    snapshot.doc_index = { attempts: {}, writings: {}, speakings: {} };
    snapshot.watermarks = {
      attempts_updated_at: null,
      writings_updated_at: null,
      speakings_updated_at: null,
    };
    snapshot.markModified("entries");
    snapshot.markModified("doc_index");
    snapshot.markModified("watermarks");
    await snapshot.save();
  }

  return snapshot;
};

const refreshAttemptsDelta = async (snapshot, userId) => {
  const since = toDateOrNull(snapshot?.watermarks?.attempts_updated_at);
  const query = {
    user_id: userId,
    type: { $in: OBJECTIVE_TYPES },
  };
  if (since) query.updatedAt = { $gt: since };

  const docs = await TestAttempt.find(query)
    .select("_id type test_id submitted_at error_logs updatedAt")
    .sort({ updatedAt: 1 })
    .lean();
  if (docs.length === 0) return false;

  const docsWithLogs = docs.filter((doc) => toSafeErrorLogArray(doc?.error_logs).length > 0);
  const snippetByTestId = await buildAttemptQuestionSnippetLookup(docsWithLogs);

  const entries = ensureObject(snapshot.entries);
  const docIndex = {
    attempts: ensureObject(snapshot?.doc_index?.attempts),
    writings: ensureObject(snapshot?.doc_index?.writings),
    speakings: ensureObject(snapshot?.doc_index?.speakings),
  };

  let latestWatermark = since;
  docs.forEach((doc) => {
    const docId = String(doc?._id || "");
    const logs = toSafeErrorLogArray(doc?.error_logs);
    const snippetLookup = snippetByTestId.get(String(doc?.test_id || "").trim());

    const builtEntries = logs.map((log, index) =>
      buildBaseEntry({
        id: buildEntryId("attempt", docId, index),
        sourceType: "test_attempt",
        sourceId: docId,
        sourceLabel: "Lan lam bai",
        sourceRef: doc?.test_id || null,
        skill: doc?.type || "unknown",
        loggedAt: doc?.submitted_at || null,
        log,
        fallbackSnippet: snippetLookup?.get(String(log?.question_number || "")) || "",
      }),
    );

    updateDocEntries({
      entries,
      indexBucket: docIndex.attempts,
      sourcePrefix: "attempt",
      docId,
      builtEntries,
    });

    const updatedAt = toDateOrNull(doc?.updatedAt);
    if (updatedAt && (!latestWatermark || updatedAt > latestWatermark)) {
      latestWatermark = updatedAt;
    }
  });

  snapshot.entries = entries;
  snapshot.doc_index = docIndex;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    attempts_updated_at: latestWatermark || snapshot?.watermarks?.attempts_updated_at || null,
  };
  snapshot.markModified("entries");
  snapshot.markModified("doc_index");
  snapshot.markModified("watermarks");
  return true;
};

const refreshWritingsDelta = async (snapshot, userId) => {
  const since = toDateOrNull(snapshot?.watermarks?.writings_updated_at);
  const query = { user_id: userId };
  if (since) query.updatedAt = { $gt: since };

  const docs = await WritingSubmission.find(query)
    .select("_id test_id submitted_at createdAt error_logs updatedAt")
    .sort({ updatedAt: 1 })
    .lean();
  if (docs.length === 0) return false;

  const entries = ensureObject(snapshot.entries);
  const docIndex = {
    attempts: ensureObject(snapshot?.doc_index?.attempts),
    writings: ensureObject(snapshot?.doc_index?.writings),
    speakings: ensureObject(snapshot?.doc_index?.speakings),
  };

  let latestWatermark = since;
  docs.forEach((doc) => {
    const docId = String(doc?._id || "");
    const logs = toSafeErrorLogArray(doc?.error_logs);
    const loggedAt = doc?.submitted_at || doc?.createdAt || null;

    const builtEntries = logs.map((log, index) =>
      buildBaseEntry({
        id: buildEntryId("writing", docId, index),
        sourceType: "writing_submission",
        sourceId: docId,
        sourceLabel: "Bai viet",
        sourceRef: doc?.test_id || null,
        skill: "writing",
        loggedAt,
        log,
      }),
    );

    updateDocEntries({
      entries,
      indexBucket: docIndex.writings,
      sourcePrefix: "writing",
      docId,
      builtEntries,
    });

    const updatedAt = toDateOrNull(doc?.updatedAt);
    if (updatedAt && (!latestWatermark || updatedAt > latestWatermark)) {
      latestWatermark = updatedAt;
    }
  });

  snapshot.entries = entries;
  snapshot.doc_index = docIndex;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    writings_updated_at: latestWatermark || snapshot?.watermarks?.writings_updated_at || null,
  };
  snapshot.markModified("entries");
  snapshot.markModified("doc_index");
  snapshot.markModified("watermarks");
  return true;
};

const refreshSpeakingsDelta = async (snapshot, userId) => {
  const since = toDateOrNull(snapshot?.watermarks?.speakings_updated_at);
  const query = { userId: userId };
  if (since) query.updatedAt = { $gt: since };

  const docs = await SpeakingSession.find(query)
    .select("_id questionId timestamp createdAt error_logs updatedAt")
    .sort({ updatedAt: 1 })
    .lean();
  if (docs.length === 0) return false;

  const entries = ensureObject(snapshot.entries);
  const docIndex = {
    attempts: ensureObject(snapshot?.doc_index?.attempts),
    writings: ensureObject(snapshot?.doc_index?.writings),
    speakings: ensureObject(snapshot?.doc_index?.speakings),
  };

  let latestWatermark = since;
  docs.forEach((doc) => {
    const docId = String(doc?._id || "");
    const logs = toSafeErrorLogArray(doc?.error_logs);
    const loggedAt = doc?.timestamp || doc?.createdAt || null;

    const builtEntries = logs.map((log, index) =>
      buildBaseEntry({
        id: buildEntryId("speaking", docId, index),
        sourceType: "speaking_session",
        sourceId: docId,
        sourceLabel: "Phien noi",
        sourceRef: doc?.questionId || null,
        skill: "speaking",
        loggedAt,
        log,
      }),
    );

    updateDocEntries({
      entries,
      indexBucket: docIndex.speakings,
      sourcePrefix: "speaking",
      docId,
      builtEntries,
    });

    const updatedAt = toDateOrNull(doc?.updatedAt);
    if (updatedAt && (!latestWatermark || updatedAt > latestWatermark)) {
      latestWatermark = updatedAt;
    }
  });

  snapshot.entries = entries;
  snapshot.doc_index = docIndex;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    speakings_updated_at: latestWatermark || snapshot?.watermarks?.speakings_updated_at || null,
  };
  snapshot.markModified("entries");
  snapshot.markModified("doc_index");
  snapshot.markModified("watermarks");
  return true;
};

const clearSourceEntries = (entries, sourceBucket = {}) => {
  Object.values(ensureObject(sourceBucket)).forEach((entryIds) => {
    ensureStringArray(entryIds).forEach((entryId) => {
      delete entries[entryId];
    });
  });
};

const rebuildAttempts = async (snapshot, userId) => {
  const docs = await TestAttempt.find({
    user_id: userId,
    type: { $in: OBJECTIVE_TYPES },
    "error_logs.0": { $exists: true },
  })
    .select("_id type test_id submitted_at error_logs updatedAt")
    .lean();

  const entries = ensureObject(snapshot.entries);
  const docIndex = {
    attempts: ensureObject(snapshot?.doc_index?.attempts),
    writings: ensureObject(snapshot?.doc_index?.writings),
    speakings: ensureObject(snapshot?.doc_index?.speakings),
  };

  clearSourceEntries(entries, docIndex.attempts);
  docIndex.attempts = {};

  const snippetByTestId = await buildAttemptQuestionSnippetLookup(docs);
  let latestWatermark = null;
  docs.forEach((doc) => {
    const docId = String(doc?._id || "");
    const logs = toSafeErrorLogArray(doc?.error_logs);
    const snippetLookup = snippetByTestId.get(String(doc?.test_id || "").trim());

    const builtEntries = logs.map((log, index) =>
      buildBaseEntry({
        id: buildEntryId("attempt", docId, index),
        sourceType: "test_attempt",
        sourceId: docId,
        sourceLabel: "Lan lam bai",
        sourceRef: doc?.test_id || null,
        skill: doc?.type || "unknown",
        loggedAt: doc?.submitted_at || null,
        log,
        fallbackSnippet: snippetLookup?.get(String(log?.question_number || "")) || "",
      }),
    );

    updateDocEntries({
      entries,
      indexBucket: docIndex.attempts,
      sourcePrefix: "attempt",
      docId,
      builtEntries,
    });

    const updatedAt = toDateOrNull(doc?.updatedAt);
    if (updatedAt && (!latestWatermark || updatedAt > latestWatermark)) {
      latestWatermark = updatedAt;
    }
  });

  snapshot.entries = entries;
  snapshot.doc_index = docIndex;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    attempts_updated_at: latestWatermark,
  };
  snapshot.markModified("entries");
  snapshot.markModified("doc_index");
  snapshot.markModified("watermarks");
};

const rebuildWritings = async (snapshot, userId) => {
  const docs = await WritingSubmission.find({
    user_id: userId,
    "error_logs.0": { $exists: true },
  })
    .select("_id test_id submitted_at createdAt error_logs updatedAt")
    .lean();

  const entries = ensureObject(snapshot.entries);
  const docIndex = {
    attempts: ensureObject(snapshot?.doc_index?.attempts),
    writings: ensureObject(snapshot?.doc_index?.writings),
    speakings: ensureObject(snapshot?.doc_index?.speakings),
  };

  clearSourceEntries(entries, docIndex.writings);
  docIndex.writings = {};

  let latestWatermark = null;
  docs.forEach((doc) => {
    const docId = String(doc?._id || "");
    const logs = toSafeErrorLogArray(doc?.error_logs);
    const loggedAt = doc?.submitted_at || doc?.createdAt || null;

    const builtEntries = logs.map((log, index) =>
      buildBaseEntry({
        id: buildEntryId("writing", docId, index),
        sourceType: "writing_submission",
        sourceId: docId,
        sourceLabel: "Bai viet",
        sourceRef: doc?.test_id || null,
        skill: "writing",
        loggedAt,
        log,
      }),
    );

    updateDocEntries({
      entries,
      indexBucket: docIndex.writings,
      sourcePrefix: "writing",
      docId,
      builtEntries,
    });

    const updatedAt = toDateOrNull(doc?.updatedAt);
    if (updatedAt && (!latestWatermark || updatedAt > latestWatermark)) {
      latestWatermark = updatedAt;
    }
  });

  snapshot.entries = entries;
  snapshot.doc_index = docIndex;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    writings_updated_at: latestWatermark,
  };
  snapshot.markModified("entries");
  snapshot.markModified("doc_index");
  snapshot.markModified("watermarks");
};

const rebuildSpeakings = async (snapshot, userId) => {
  const docs = await SpeakingSession.find({
    userId: userId,
    "error_logs.0": { $exists: true },
  })
    .select("_id questionId timestamp createdAt error_logs updatedAt")
    .lean();

  const entries = ensureObject(snapshot.entries);
  const docIndex = {
    attempts: ensureObject(snapshot?.doc_index?.attempts),
    writings: ensureObject(snapshot?.doc_index?.writings),
    speakings: ensureObject(snapshot?.doc_index?.speakings),
  };

  clearSourceEntries(entries, docIndex.speakings);
  docIndex.speakings = {};

  let latestWatermark = null;
  docs.forEach((doc) => {
    const docId = String(doc?._id || "");
    const logs = toSafeErrorLogArray(doc?.error_logs);
    const loggedAt = doc?.timestamp || doc?.createdAt || null;

    const builtEntries = logs.map((log, index) =>
      buildBaseEntry({
        id: buildEntryId("speaking", docId, index),
        sourceType: "speaking_session",
        sourceId: docId,
        sourceLabel: "Phien noi",
        sourceRef: doc?.questionId || null,
        skill: "speaking",
        loggedAt,
        log,
      }),
    );

    updateDocEntries({
      entries,
      indexBucket: docIndex.speakings,
      sourcePrefix: "speaking",
      docId,
      builtEntries,
    });

    const updatedAt = toDateOrNull(doc?.updatedAt);
    if (updatedAt && (!latestWatermark || updatedAt > latestWatermark)) {
      latestWatermark = updatedAt;
    }
  });

  snapshot.entries = entries;
  snapshot.doc_index = docIndex;
  snapshot.watermarks = {
    ...(snapshot.watermarks || {}),
    speakings_updated_at: latestWatermark,
  };
  snapshot.markModified("entries");
  snapshot.markModified("doc_index");
  snapshot.markModified("watermarks");
};

const maybeRebuildOnDrift = async (snapshot, userId) => {
  const docIndex = {
    attempts: ensureObject(snapshot?.doc_index?.attempts),
    writings: ensureObject(snapshot?.doc_index?.writings),
    speakings: ensureObject(snapshot?.doc_index?.speakings),
  };

  const [attemptCount, writingCount, speakingCount] = await Promise.all([
    TestAttempt.countDocuments({
      user_id: userId,
      type: { $in: OBJECTIVE_TYPES },
      "error_logs.0": { $exists: true },
    }),
    WritingSubmission.countDocuments({
      user_id: userId,
      "error_logs.0": { $exists: true },
    }),
    SpeakingSession.countDocuments({
      userId: userId,
      "error_logs.0": { $exists: true },
    }),
  ]);

  let rebuilt = false;
  if (Object.keys(docIndex.attempts).length !== attemptCount) {
    await rebuildAttempts(snapshot, userId);
    rebuilt = true;
  }
  if (Object.keys(docIndex.writings).length !== writingCount) {
    await rebuildWritings(snapshot, userId);
    rebuilt = true;
  }
  if (Object.keys(docIndex.speakings).length !== speakingCount) {
    await rebuildSpeakings(snapshot, userId);
    rebuilt = true;
  }

  return rebuilt;
};

export const loadErrorAnalyticsEntriesWithDelta = async (targetUserId) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    const error = new Error("Invalid user id");
    error.status = 400;
    throw error;
  }

  const objectId = new mongoose.Types.ObjectId(targetUserId);
  const snapshot = await getOrCreateSnapshot(objectId);

  const attemptDelta = await refreshAttemptsDelta(snapshot, objectId);
  const writingDelta = await refreshWritingsDelta(snapshot, objectId);
  const speakingDelta = await refreshSpeakingsDelta(snapshot, objectId);
  const rebuilt = await maybeRebuildOnDrift(snapshot, objectId);
  const changed = attemptDelta || writingDelta || speakingDelta || rebuilt;

  if (changed) {
    snapshot.refreshed_at = new Date();
    await snapshot.save();
  }

  return Object.values(ensureObject(snapshot.entries));
};
