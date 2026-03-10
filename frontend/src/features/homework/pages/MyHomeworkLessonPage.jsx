import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  USER_ROLE_STUDENT_ACA,
  normalizeUserRole,
  studentAcaPath,
  studentIeltsPath,
} from "@/app/roleRouting";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import {
  LessonFeedbackCard,
  LessonHeaderBar,
  LessonMissionCard,
  LessonStateCard,
  LessonSubmissionPanel,
  LessonTaskBlocks,
  buildChecklistItems,
  buildMissionResources,
  resolveLessonStatusLabel,
} from "@/features/homework/components/lesson";
import {
  MATCH_COLOR_TOKENS,
  normalizeBlockId,
  normalizeMatchingPairData,
  resolveMatchColorToken,
  resolveTaskBlockId,
} from "@/features/homework/components/lesson/blocks/blockUtils";
import {
  createDraft,
  getRenderableTaskBlocks,
  getTaskBlockKey,
  normalizeTaskBlockType,
  resolveTaskInputType,
} from "./myHomeworkStudentUtils";
import { useHomeworkAssignmentDetail } from "./useHomeworkAssignmentDetail";

const countWords = (value = "") => {
  const matches = String(value || "").trim().match(/\S+/g);
  return matches ? matches.length : 0;
};

const normalizeObjectiveAnswerEntries = (entries = [], keyField, valueField) => {
  const entryMap = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const key = String(entry?.[keyField] || "").trim();
    const value = String(entry?.[valueField] || "").trim();
    if (!key || !value) return;
    entryMap.set(key, { [keyField]: key, [valueField]: value });
  });
  return Array.from(entryMap.values());
};

const normalizeMatchingObjectiveAnswerEntries = (entries = []) => {
  const blockMap = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const blockKey = String(entry?.block_key || entry?.blockKey || entry?.block_id || "").trim();
    if (!blockKey) return;
    const pairMap = new Map();
    const rawPairs = Array.isArray(entry?.matches)
      ? entry.matches
      : Array.isArray(entry?.pairs)
        ? entry.pairs
        : [];
    rawPairs.forEach((pair) => {
      const leftId = String(pair?.left_id || pair?.leftId || "").trim();
      const rightId = String(pair?.right_id || pair?.rightId || "").trim();
      if (!leftId || !rightId) return;
      pairMap.set(`${leftId}:${rightId}`, {
        left_id: leftId,
        right_id: rightId,
      });
    });
    if (pairMap.size === 0) return;
    blockMap.set(blockKey, {
      block_key: blockKey,
      matches: Array.from(pairMap.values()),
    });
  });
  return Array.from(blockMap.values());
};

const buildObjectiveAnswersPayload = ({
  quizSelections = {},
  gapfillSelections = {},
  findMistakeSelections = {},
  matchingSelections = {},
} = {}) => {
  const quiz = normalizeObjectiveAnswerEntries(
    Object.entries(quizSelections || {}).map(([questionKey, selectedOptionId]) => ({
      question_key: questionKey,
      selected_option_id: selectedOptionId,
    })),
    "question_key",
    "selected_option_id",
  );
  const gapfill = normalizeObjectiveAnswerEntries(
    Object.entries(gapfillSelections || {}).map(([blankKey, value]) => ({
      blank_key: blankKey,
      value,
    })),
    "blank_key",
    "value",
  );
  const find_mistake = normalizeObjectiveAnswerEntries(
    Object.entries(findMistakeSelections || {}).map(([lineKey, tokenKey]) => ({
      line_key: lineKey,
      token_key: tokenKey,
    })),
    "line_key",
    "token_key",
  );
  const matching = normalizeMatchingObjectiveAnswerEntries(
    Object.entries(matchingSelections || {}).map(([blockKey, selection]) => ({
      block_key: blockKey,
      matches: Array.isArray(selection?.matches) ? selection.matches : [],
    })),
  );
  return { quiz, gapfill, find_mistake, matching };
};

const hasObjectiveAnswersPayload = (payload = {}) =>
  (Array.isArray(payload?.quiz) && payload.quiz.length > 0)
  || (Array.isArray(payload?.gapfill) && payload.gapfill.length > 0)
  || (Array.isArray(payload?.find_mistake) && payload.find_mistake.length > 0)
  || (Array.isArray(payload?.matching) && payload.matching.length > 0);

const PAGE_WRAPPER_CLASS = "min-h-screen bg-[#f5f7fb] text-slate-900";
const PAGE_SHELL_CLASS = "mx-auto max-w-6xl px-4 py-8 md:px-6 lg:px-8";
const MAX_UPLOAD_FILES = 10;

export default function MyHomeworkLessonPage() {
  const { assignmentId, lessonId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const user = api.getUser();

  const {
    isPreviewMode,
    canAccessPage,
    loading,
    error,
    assignment,
    tasks,
    submissionsByTaskId,
    reloadAssignment,
  } = useHomeworkAssignmentDetail(assignmentId);

  const [drafts, setDrafts] = useState({});
  const [findMistakeSelections, setFindMistakeSelections] = useState({});
  const [gapfillSelections, setGapfillSelections] = useState({});
  const [quizSelections, setQuizSelections] = useState({});
  const [matchingSelections, setMatchingSelections] = useState({});
  const [launchingScopeKeys, setLaunchingScopeKeys] = useState({});

  const recordersRef = useRef(new Map());
  const streamsRef = useRef(new Map());
  const chunksRef = useRef(new Map());
  const previewUrlsRef = useRef(new Set());

  const normalizedRole = normalizeUserRole(user?.role);
  const studentHomeworkBasePath =
    normalizedRole === USER_ROLE_STUDENT_ACA ? studentAcaPath("/homework") : studentIeltsPath("/homework");
  const lessonListPath = `${studentHomeworkBasePath}/${assignmentId}${isPreviewMode ? "?preview=1" : ""}`;
  const monthPath = studentHomeworkBasePath;

  const selectedTask = useMemo(
    () => tasks.find((task) => String(task?._id || "") === String(lessonId || "")),
    [tasks, lessonId],
  );

  const selectedTaskId = String(selectedTask?._id || "");
  const selectedTaskIndex = useMemo(
    () => tasks.findIndex((task) => String(task?._id || "") === selectedTaskId),
    [tasks, selectedTaskId],
  );

  const submission = submissionsByTaskId.get(selectedTaskId);
  const draft = drafts[selectedTaskId] || createDraft(submission);

  const effectiveTaskDueAt = useMemo(() => {
    const dueValue = selectedTask?.due_date || assignment?.due_date || null;
    if (!dueValue) return null;
    const dueDate = new Date(dueValue);
    if (Number.isNaN(dueDate.getTime())) return null;
    return dueDate;
  }, [assignment?.due_date, selectedTask?.due_date]);

  const isDeadlinePassed = useMemo(() => {
    if (!effectiveTaskDueAt) return false;
    return Date.now() > effectiveTaskDueAt.getTime();
  }, [effectiveTaskDueAt]);

  const isLateSubmission = useMemo(() => {
    if (!submission || !effectiveTaskDueAt) return false;
    const submittedAt = submission?.submitted_at ? new Date(submission.submitted_at) : null;
    if (!submittedAt || Number.isNaN(submittedAt.getTime())) return false;
    return submittedAt.getTime() > effectiveTaskDueAt.getTime();
  }, [effectiveTaskDueAt, submission]);

  const updateDraft = (taskId, patch) =>
    setDrafts((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || createDraft()), ...patch },
    }));

  useEffect(() => {
    const nextDrafts = {};
    (assignment?.submissions || []).forEach((taskSubmission) => {
      nextDrafts[String(taskSubmission.task_id || "")] = createDraft(taskSubmission);
    });
    setDrafts(nextDrafts);
  }, [assignment]);

  useEffect(() => {
    setFindMistakeSelections({});
    setGapfillSelections({});
    setQuizSelections({});
    setMatchingSelections({});
  }, [selectedTaskId]);

  const handleSelectFindMistakeToken = (lineKey, tokenKey) => {
    if (!lineKey) return;
    setFindMistakeSelections((prev) => {
      const current = String(prev[lineKey] || "");
      const next = { ...prev };
      if (current && current === tokenKey) {
        delete next[lineKey];
        return next;
      }
      next[lineKey] = tokenKey;
      return next;
    });
  };

  const handleSelectQuizOption = ({ questionKey, optionId }) => {
    if (!questionKey || !optionId) return;
    setQuizSelections((prev) => {
      const current = String(prev[questionKey] || "");
      if (current === optionId) {
        const next = { ...prev };
        delete next[questionKey];
        return next;
      }
      return {
        ...prev,
        [questionKey]: optionId,
      };
    });
  };

  const handleChangeGapfillBlank = (blankKey, value) => {
    if (!blankKey) return;
    setGapfillSelections((prev) => {
      const next = { ...prev };
      const normalizedValue = String(value || "");
      if (!normalizedValue.trim()) {
        delete next[blankKey];
        return next;
      }
      next[blankKey] = normalizedValue;
      return next;
    });
  };

  const getNextMatchingColorToken = (pairs = []) => {
    const usedColorKeys = new Set(
      (Array.isArray(pairs) ? pairs : [])
        .map((pair) => resolveMatchColorToken(pair?.color_key))
        .filter(Boolean),
    );
    return (
      MATCH_COLOR_TOKENS.find((token) => !usedColorKeys.has(token))
      || MATCH_COLOR_TOKENS[(Array.isArray(pairs) ? pairs.length : 0) % MATCH_COLOR_TOKENS.length]
    );
  };

  const updateMatchingSelectionByBlock = (blockId, updater) => {
    const normalizedBlockId = normalizeBlockId(blockId);
    if (!normalizedBlockId) return;

    setMatchingSelections((prev) => {
      const current = prev[normalizedBlockId] && typeof prev[normalizedBlockId] === "object"
        ? prev[normalizedBlockId]
        : { selected_left_id: "", matches: [] };
      const nextRaw = typeof updater === "function" ? updater(current) : updater;
      const nextPairs = (Array.isArray(nextRaw?.matches) ? nextRaw.matches : [])
        .map((pair, pairIndex) => normalizeMatchingPairData(pair, pairIndex))
        .filter((pair) => pair.left_id && pair.right_id);

      return {
        ...prev,
        [normalizedBlockId]: {
          selected_left_id: normalizeBlockId(nextRaw?.selected_left_id),
          matches: nextPairs,
        },
      };
    });
  };

  const handleMatchingLeftCellClick = (blockId, leftItemId) => {
    const normalizedLeftId = normalizeBlockId(leftItemId);
    if (!normalizedLeftId) return;

    updateMatchingSelectionByBlock(blockId, (current) => {
      const selectedLeft = normalizeBlockId(current?.selected_left_id);
      const currentPairs = Array.isArray(current?.matches) ? current.matches : [];
      if (selectedLeft === normalizedLeftId) {
        return { ...current, selected_left_id: "" };
      }

      if (currentPairs.some((pair) => normalizeBlockId(pair?.left_id) === normalizedLeftId)) {
        return {
          ...current,
          selected_left_id: "",
          matches: currentPairs.filter((pair) => normalizeBlockId(pair?.left_id) !== normalizedLeftId),
        };
      }

      return { ...current, selected_left_id: normalizedLeftId };
    });
  };

  const handleMatchingRightCellClick = (blockId, rightItemId) => {
    const normalizedRightId = normalizeBlockId(rightItemId);
    if (!normalizedRightId) return;

    updateMatchingSelectionByBlock(blockId, (current) => {
      const selectedLeft = normalizeBlockId(current?.selected_left_id);
      const currentPairs = Array.isArray(current?.matches) ? current.matches : [];

      if (!selectedLeft) {
        if (!currentPairs.some((pair) => normalizeBlockId(pair?.right_id) === normalizedRightId)) {
          return current;
        }
        return {
          ...current,
          matches: currentPairs.filter((pair) => normalizeBlockId(pair?.right_id) !== normalizedRightId),
        };
      }

      const hasExactPair = currentPairs.some(
        (pair) =>
          normalizeBlockId(pair?.left_id) === selectedLeft
          && normalizeBlockId(pair?.right_id) === normalizedRightId,
      );
      if (hasExactPair) {
        return {
          ...current,
          selected_left_id: "",
          matches: currentPairs.filter(
            (pair) => !(
              normalizeBlockId(pair?.left_id) === selectedLeft
              && normalizeBlockId(pair?.right_id) === normalizedRightId
            ),
          ),
        };
      }

      const filteredPairs = currentPairs.filter(
        (pair) =>
          normalizeBlockId(pair?.left_id) !== selectedLeft
          && normalizeBlockId(pair?.right_id) !== normalizedRightId,
      );

      return {
        ...current,
        selected_left_id: "",
        matches: [
          ...filteredPairs,
          {
            left_id: selectedLeft,
            right_id: normalizedRightId,
            color_key: getNextMatchingColorToken(filteredPairs),
          },
        ],
      };
    });
  };

  const revokePreviewUrl = (url) => {
    const normalized = String(url || "");
    if (!normalized.startsWith("blob:")) return;
    try {
      URL.revokeObjectURL(normalized);
    } catch {
      // ignore URL revocation errors
    }
    previewUrlsRef.current.delete(normalized);
  };

  const clearDraftAudio = (taskId) => {
    setDrafts((prev) => {
      const nextDraft = { ...(prev[taskId] || createDraft()) };
      if (nextDraft.audio_preview_url) {
        revokePreviewUrl(nextDraft.audio_preview_url);
      }
      nextDraft.audio_file = null;
      nextDraft.audio_preview_url = "";
      nextDraft.audio_error = "";
      return {
        ...prev,
        [taskId]: nextDraft,
      };
    });
  };

  const finalizeRecorderForTask = (taskId, { forceDiscard = false, skipDraftUpdate = false } = {}) => {
    const stream = streamsRef.current.get(taskId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamsRef.current.delete(taskId);
    }

    const recordedChunks = chunksRef.current.get(taskId) || [];
    chunksRef.current.delete(taskId);
    recordersRef.current.delete(taskId);

    if (forceDiscard || !recordedChunks.length) {
      if (skipDraftUpdate) return;
      updateDraft(taskId, { is_recording: false });
      return;
    }

    const blob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || "audio/webm" });
    const mimeType = blob.type || "audio/webm";
    const extension = mimeType.includes("mp4")
      ? "mp4"
      : mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("mpeg") || mimeType.includes("mp3")
          ? "mp3"
          : "webm";

    const file = new File([blob], `homework-recording-${Date.now()}.${extension}`, { type: mimeType });
    const previewUrl = URL.createObjectURL(blob);
    previewUrlsRef.current.add(previewUrl);

    if (skipDraftUpdate) return;

    setDrafts((prev) => {
      const nextDraft = { ...(prev[taskId] || createDraft()) };
      if (nextDraft.audio_preview_url) {
        revokePreviewUrl(nextDraft.audio_preview_url);
      }
      nextDraft.audio_file = file;
      nextDraft.audio_preview_url = previewUrl;
      nextDraft.audio_error = "";
      nextDraft.is_recording = false;
      return {
        ...prev,
        [taskId]: nextDraft,
      };
    });
  };

  const stopAudioRecording = (taskId, options = {}) => {
    const recorder = recordersRef.current.get(taskId);
    if (!recorder) return;

    if (options.forceDiscard) {
      try {
        recorder.onstop = null;
        recorder.onerror = null;
        recorder.ondataavailable = null;
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        // ignore recorder shutdown errors
      }
      finalizeRecorderForTask(taskId, { forceDiscard: true, skipDraftUpdate: Boolean(options.skipDraftUpdate) });
      return;
    }

    try {
      if (recorder.state !== "inactive") recorder.stop();
      else finalizeRecorderForTask(taskId, { skipDraftUpdate: Boolean(options.skipDraftUpdate) });
    } catch {
      finalizeRecorderForTask(taskId, { forceDiscard: true, skipDraftUpdate: Boolean(options.skipDraftUpdate) });
    }
  };

  const stopAllRecordings = ({ forceDiscard = false, skipDraftUpdate = false } = {}) => {
    Array.from(recordersRef.current.keys()).forEach((taskId) => {
      stopAudioRecording(taskId, { forceDiscard, skipDraftUpdate });
    });
  };

  const startAudioRecording = async (taskId) => {
    if (isPreviewMode) return;

    if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showNotification("Browser does not support microphone recording", "error");
      return;
    }

    stopAllRecordings({ forceDiscard: true });
    clearDraftAudio(taskId);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const selectedMimeType = preferredMimeTypes.find(
        (mimeType) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(mimeType),
      );
      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);

      streamsRef.current.set(taskId, stream);
      recordersRef.current.set(taskId, recorder);
      chunksRef.current.set(taskId, []);

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size <= 0) return;
        const currentChunks = chunksRef.current.get(taskId) || [];
        chunksRef.current.set(taskId, [...currentChunks, event.data]);
      };
      recorder.onstop = () => finalizeRecorderForTask(taskId);
      recorder.onerror = () => {
        finalizeRecorderForTask(taskId, { forceDiscard: true });
        updateDraft(taskId, { audio_error: "Failed to record audio." });
      };

      recorder.start(250);
      updateDraft(taskId, { is_recording: true, audio_error: "" });
    } catch {
      updateDraft(taskId, { is_recording: false, audio_error: "Cannot access microphone." });
      showNotification("Cannot access microphone", "error");
    }
  };

  useEffect(() => () => {
    stopAllRecordings({ forceDiscard: true, skipDraftUpdate: true });
    Array.from(previewUrlsRef.current).forEach((url) => revokePreviewUrl(url));
  }, []);

  useEffect(() => {
    stopAllRecordings({ forceDiscard: true, skipDraftUpdate: true });
  }, [lessonId]);

  const handleSubmitTask = async () => {
    if (isPreviewMode || !selectedTaskId) return;

    const currentDraft = drafts[selectedTaskId] || createDraft(submission);
    if (currentDraft.is_recording) {
      showNotification("Please stop recording before submitting", "error");
      return;
    }
    const retainedImageItems = Array.isArray(currentDraft.existing_image_items)
      ? currentDraft.existing_image_items
      : [];
    const retainedImageKeys = retainedImageItems
      .map((item) => String(item?.storage_key || "").trim())
      .filter(Boolean);
    const nextUploadFiles = Array.isArray(currentDraft.image_files) ? currentDraft.image_files : [];
    if (retainedImageKeys.length + nextUploadFiles.length > MAX_UPLOAD_FILES) {
      showNotification(`Maximum ${MAX_UPLOAD_FILES} files are allowed`, "error");
      return;
    }

    updateDraft(selectedTaskId, { submitting: true });

    try {
      const formData = new FormData();
      if (currentDraft.text_answer !== undefined) {
        formData.append("text_answer", currentDraft.text_answer || "");
      }

      const objectiveAnswers = buildObjectiveAnswersPayload({
        quizSelections,
        gapfillSelections,
        findMistakeSelections,
        matchingSelections,
      });
      if (hasObjectiveAnswersPayload(objectiveAnswers)) {
        formData.append("objective_answers", JSON.stringify(objectiveAnswers));
      }

      if (hasImageInput) {
        formData.append("retain_image_keys", JSON.stringify(retainedImageKeys));
      }
      nextUploadFiles.forEach((file) => {
        formData.append("images", file);
      });
      if (currentDraft.audio_file) {
        formData.append("audio", currentDraft.audio_file);
      }

      await api.homeworkSubmitTask(assignmentId, selectedTaskId, formData);
      showNotification("Task submitted", "success");
      if (currentDraft.audio_preview_url) {
        revokePreviewUrl(currentDraft.audio_preview_url);
      }
      await reloadAssignment();
      updateDraft(selectedTaskId, {
        image_files: [],
        audio_file: null,
        audio_preview_url: "",
        audio_error: "",
      });
    } catch (submitError) {
      showNotification(submitError?.message || "Failed to submit task", "error");
    } finally {
      updateDraft(selectedTaskId, { submitting: false });
    }
  };

  const getHomeworkTabSessionId = () => {
    if (typeof window === "undefined") return "";
    const storageKey = `homework-tab-session:${assignmentId}`;
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;

    const nextId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    window.sessionStorage.setItem(storageKey, nextId);
    return nextId;
  };

  const createClientEventId = () =>
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const openInternalLaunchUrl = (launchUrl) => {
    const normalizedUrl = String(launchUrl || "").trim();
    if (!normalizedUrl) return;

    if (typeof window === "undefined") return;

    const sameTabWindow = window.open(normalizedUrl, "_self", "noopener");
    if (!sameTabWindow) {
      window.location.assign(normalizedUrl);
    }
  };

  const handleLaunchInternalResource = async ({ block, task }) => {
    if (!assignmentId || !selectedTaskId) return;

    const blockData = block?.data && typeof block.data === "object" && !Array.isArray(block.data) ? block.data : {};

    const resourceRefType = String(block?.resourceRefType || blockData?.resource_ref_type || "").trim();
    const resourceRefId = String(block?.resourceRefId || blockData?.resource_ref_id || "").trim();
    const resourceBlockId = String(block?.resourceBlockId || resolveTaskBlockId(block) || blockData?.block_id || "").trim();
    const resourceSlotKey = String(
      block?.resourceSlotKey
      || blockData?.resource_slot_key
      || (resourceBlockId ? `block:${resourceBlockId}` : ""),
    ).trim();
    const launchScopeKey = String(block?.launchScopeKey || `${selectedTaskId}:${resourceSlotKey}`).trim();

    if (!resourceRefType || !resourceRefId || !resourceSlotKey) {
      showNotification("Internal resource is not configured.", "error");
      return;
    }
    if (launchScopeKey && launchingScopeKeys?.[launchScopeKey]) return;

    setLaunchingScopeKeys((prev) => ({
      ...prev,
      [launchScopeKey]: true,
    }));

    try {
      const result = await api.homeworkLaunchTaskTracking(assignmentId, selectedTaskId, {
        event_id: createClientEventId(),
        tab_session_id: getHomeworkTabSessionId(),
        client_ts: new Date().toISOString(),
        resource_ref_type: resourceRefType,
        resource_ref_id: resourceRefId,
        resource_slot_key: resourceSlotKey,
        resource_block_id: resourceBlockId,
      });

      const launchUrl = String(result?.data?.launch_url || "").trim();
      if (!launchUrl) {
        throw new Error("Launch URL is unavailable");
      }
      openInternalLaunchUrl(launchUrl);
    } catch (error) {
      showNotification(error?.message || "Cannot launch internal resource.", "error");
    } finally {
      setLaunchingScopeKeys((prev) => {
        const next = { ...prev };
        delete next[launchScopeKey];
        return next;
      });
    }
  };

  const renderState = (content) => (
    <div className={PAGE_WRAPPER_CLASS}>
      <div className={PAGE_SHELL_CLASS}>{content}</div>
    </div>
  );

  if (!canAccessPage) {
    return renderState(
      <LessonStateCard
        message={isPreviewMode
          ? "Preview mode is only available for teacher/supervisor/admin accounts."
          : "This page is only available for student accounts."}
      />, 
    );
  }

  if (loading) {
    return renderState(<LessonStateCard message="Loading lesson..." />);
  }

  if (error || !assignment) {
    return renderState(
      <LessonStateCard
        message={error || "Assignment not found"}
        tone="danger"
        actionLabel="Back"
        onAction={() => navigate(isPreviewMode ? `/homework/assignments/${assignmentId}` : monthPath)}
      />,
    );
  }

  const taskBlocks = selectedTask ? getRenderableTaskBlocks(selectedTask) : [];
  const inputType = resolveTaskInputType(selectedTask);
  const hasTextInput = inputType === "text";
  const hasImageInput = inputType === "image";
  const hasAudioInput = inputType === "audio";

  const hasDictationBlock = taskBlocks.some((block) => normalizeTaskBlockType(block?.type) === "dictation");
  const shouldUseDictationTranscript = hasTextInput && hasDictationBlock;

  const canSubmit = !isPreviewMode;
  const canInteract = !draft.submitting;

  const textAnswerPlaceholder =
    selectedTask?.min_words || selectedTask?.max_words
      ? `Type your answer here (${selectedTask.min_words || 0}-${selectedTask.max_words || "inf"} words)...`
      : "Type your answer here...";

  const textAnswerWordCount = countWords(String(draft.text_answer || ""));
  const uploadInputId = `homework-upload-input-${String(selectedTaskId || "task").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const lessonStatusLabel = resolveLessonStatusLabel({
    submission,
    isPreviewMode,
    isDeadlinePassed,
    isLateSubmission,
  });

  const getBlockKey = (block, fallbackIndex) =>
    getTaskBlockKey({ taskId: selectedTaskId, block, fallbackIndex });

  const checklistItems = buildChecklistItems({ task: selectedTask, taskBlocks });
  const missionResources = buildMissionResources({
    taskBlocks,
    taskId: selectedTaskId,
    getBlockKey,
  });
  const missionResourcesWithState = missionResources.map((resource) => {
    if (resource?.blockType !== "internal") return resource;

    const block = resource?.block && typeof resource.block === "object" ? resource.block : {};
    const blockData =
      block?.data && typeof block.data === "object" && !Array.isArray(block.data)
        ? block.data
        : {};
    const resourceRefType = String(resource?.resourceRefType || blockData?.resource_ref_type || "").trim();
    const resourceRefId = String(resource?.resourceRefId || blockData?.resource_ref_id || "").trim();
    const resourceBlockId = String(resolveTaskBlockId(block) || blockData?.block_id || "").trim();
    const resourceSlotKey =
      String(resource?.resourceSlotKey || blockData?.resource_slot_key || "").trim()
      || (resourceBlockId ? `block:${resourceBlockId}` : "");
    const launchScopeKey = resourceSlotKey ? `${selectedTaskId}:${resourceSlotKey}` : "";
    const hasInternalConfig = Boolean(resourceRefType && resourceRefId && resourceSlotKey);
    const isLaunching = Boolean(launchScopeKey && launchingScopeKeys?.[launchScopeKey]);

    return {
      ...resource,
      block: {
        ...block,
        resourceRefType,
        resourceRefId,
        resourceBlockId,
        resourceSlotKey,
        launchScopeKey,
      },
      actionLabel: isLaunching ? "Launching..." : "Launch Resource",
      disabled: !canAccessPage || isPreviewMode || !hasInternalConfig || isLaunching,
    };
  });

  const handleOpenMissionResource = (resource) => {
    if (!resource) return;

    if (resource.blockType === "internal") {
      void handleLaunchInternalResource({ block: resource.block, task: selectedTask });
      return;
    }

    if (typeof document === "undefined") return;
    const target = document.getElementById(resource.anchorId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={PAGE_WRAPPER_CLASS}>
      <div className={PAGE_SHELL_CLASS}>
        <div className="space-y-6">
          <LessonHeaderBar
            assignmentTitle={assignment?.title || "Assignment"}
            lessonTitle={selectedTask?.title || "Lesson"}
            statusLabel={lessonStatusLabel}
            resourceCount={missionResourcesWithState.length}
            onBack={() => navigate(lessonListPath)}
          />

          {!selectedTask ? (
            <LessonStateCard
              message="Lesson not found."
              tone="danger"
              actionLabel="Back to Month"
              onAction={() => navigate(lessonListPath)}
            />
          ) : (
            <>
              {isPreviewMode ? (
                <LessonStateCard
                  message="Preview mode: this page simulates student UI. Submit actions are disabled."
                  tone="warn"
                />
              ) : null}

              {isDeadlinePassed ? (
                <LessonStateCard
                  message="Deadline has passed. You can still submit, but the submission will be marked as late."
                  tone="danger"
                />
              ) : null}

              <div className="space-y-6">
                <LessonMissionCard
                  lessonTitle={selectedTask?.title || "Lesson"}
                  statusLabel={lessonStatusLabel}
                  checklistItems={checklistItems}
                  resources={missionResourcesWithState}
                  onOpenResource={handleOpenMissionResource}
                  disabled={!canInteract}
                />

                <LessonTaskBlocks
                  taskBlocks={taskBlocks}
                  selectedTaskId={selectedTaskId}
                  renderContext={{
                    selectedTask,
                    selectedTaskIndex,
                    canInteract,
                    canAccessPage,
                    isPreviewMode,
                    shouldUseDictationTranscript,
                    textAnswerPlaceholder,
                  }}
                  blockActions={{
                    launchingScopeKeys,
                    onLaunchInternal: handleLaunchInternalResource,
                    findMistakeSelections,
                    onSelectFindMistakeToken: handleSelectFindMistakeToken,
                    gapfillSelections,
                    onChangeGapfillBlank: handleChangeGapfillBlank,
                    quizSelections,
                    onSelectQuizOption: handleSelectQuizOption,
                    matchingSelections,
                    onMatchingLeftClick: handleMatchingLeftCellClick,
                    onMatchingRightClick: handleMatchingRightCellClick,
                    draft,
                    onChangeTextAnswer: (value) => updateDraft(selectedTaskId, { text_answer: value }),
                    onClearTextAnswer: () => updateDraft(selectedTaskId, { text_answer: "" }),
                  }}
                />

                <LessonFeedbackCard feedback={submission?.teacher_feedback} />

                <LessonSubmissionPanel
                  hasTextInput={hasTextInput}
                  hasImageInput={hasImageInput}
                  hasAudioInput={hasAudioInput}
                  draft={draft}
                  submission={submission}
                  canInteract={canInteract}
                  canSubmit={canSubmit}
                  isPreviewMode={isPreviewMode}
                  isDeadlinePassed={isDeadlinePassed}
                  isLateSubmission={isLateSubmission}
                  shouldUseDictationTranscript={shouldUseDictationTranscript}
                  textAnswerPlaceholder={textAnswerPlaceholder}
                  textAnswerWordCount={textAnswerWordCount}
                  uploadInputId={uploadInputId}
                  maxMediaFiles={MAX_UPLOAD_FILES}
                  onDraftChange={(patch) => updateDraft(selectedTaskId, patch)}
                  onStartRecord={() => void startAudioRecording(selectedTaskId)}
                  onStopRecord={() => stopAudioRecording(selectedTaskId)}
                  onClearAudio={() => clearDraftAudio(selectedTaskId)}
                  onSubmit={() => void handleSubmitTask()}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
