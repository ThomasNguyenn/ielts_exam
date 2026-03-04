import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { formatDate, resolveVideoPreview, statusLabel } from "./homework.utils";
import "./Homework.css";

const createDraft = (submission = {}) => ({
  text_answer: submission?.text_answer || "",
  image_files: [],
  audio_file: null,
  audio_preview_url: "",
  audio_error: "",
  is_recording: false,
  submitting: false,
});

const resolveTaskInputType = (task = {}) => {
  const blocks = Array.isArray(task?.content_blocks) ? task.content_blocks : [];
  const sortedInputBlocks = blocks
    .filter((block) => String(block?.type || "") === "input")
    .slice()
    .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0));
  const latestInputBlock = sortedInputBlocks[sortedInputBlocks.length - 1];
  const inputData = latestInputBlock?.data && typeof latestInputBlock.data === "object" ? latestInputBlock.data : {};
  const explicitType = String(inputData?.input_type || "").trim().toLowerCase();
  if (["text", "image", "audio"].includes(explicitType)) return explicitType;
  if (Boolean(task?.requires_audio) || Boolean(inputData?.requires_audio)) return "audio";
  if (Boolean(task?.requires_image) || Boolean(inputData?.requires_image)) return "image";
  if (Boolean(task?.requires_text) || Boolean(inputData?.requires_text)) return "text";
  return null;
};

const inputTypeToLabel = (inputType) => {
  if (inputType === "audio") return "Audio recording";
  if (inputType === "image") return "Image upload";
  if (inputType === "text") return "Text response";
  return null;
};

const buildPreviewAssignmentFromManageData = (assignment = {}) => {
  const sections = Array.isArray(assignment?.sections) ? assignment.sections : [];
  const publishedSections = sections
    .filter((section) => Boolean(section?.is_published))
    .map((section) => ({
      ...section,
      lessons: (Array.isArray(section?.lessons) ? section.lessons : []).filter((lesson) =>
        Boolean(lesson?.is_published),
      ),
    }))
    .filter((section) => (section.lessons || []).length > 0);

  const tasks = [];
  publishedSections.forEach((section, sectionIndex) => {
    (section.lessons || []).forEach((lesson, lessonIndex) => {
      tasks.push({
        _id: lesson?._id || `${sectionIndex}-${lessonIndex}`,
        type: lesson?.type || "custom_task",
        title: lesson?.name || `Task ${tasks.length + 1}`,
        instruction: lesson?.instruction || "",
        order: Number.isFinite(Number(lesson?.order)) ? Number(lesson.order) : tasks.length,
        resource_mode: lesson?.resource_mode || "internal",
        resource_ref_type: lesson?.resource_ref_type || null,
        resource_ref_id: lesson?.resource_ref_id || null,
        resource_url: lesson?.resource_url || null,
        resource_storage_key: lesson?.resource_storage_key || null,
        requires_text: Boolean(lesson?.requires_text),
        requires_image: Boolean(lesson?.requires_image),
        requires_audio: Boolean(lesson?.requires_audio),
        min_words: lesson?.min_words ?? null,
        max_words: lesson?.max_words ?? null,
        due_date: lesson?.due_date || null,
        content_blocks: Array.isArray(lesson?.content_blocks)
          ? lesson.content_blocks.map((block, blockIndex) => ({
              type: String(block?.type || "instruction"),
              order: Number.isFinite(Number(block?.order)) ? Number(block.order) : blockIndex,
              data: block?.data && typeof block.data === "object" ? { ...block.data } : {},
            }))
          : [],
      });
    });
  });

  return {
    ...assignment,
    sections: publishedSections,
    tasks,
    submissions: [],
    progress: {
      submitted_tasks: 0,
      total_tasks: tasks.length,
      graded_tasks: 0,
      pending_tasks: tasks.length,
    },
  };
};

export default function MyHomeworkDetailPage() {
  const { assignmentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const user = api.getUser();

  const isPreviewMode = searchParams.get("preview") === "1";
  const isManageUser = user?.role === "teacher" || user?.role === "admin";
  const canAccessPage = isPreviewMode ? isManageUser : user?.role === "student";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignment, setAssignment] = useState(null);
  const [drafts, setDrafts] = useState({});
  const recordersRef = useRef(new Map());
  const streamsRef = useRef(new Map());
  const chunksRef = useRef(new Map());
  const previewUrlsRef = useRef(new Set());

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
      const recorder = selectedMimeType ? new MediaRecorder(stream, { mimeType: selectedMimeType }) : new MediaRecorder(stream);

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

  const loadAssignment = async () => {
    setLoading(true);
    setError("");
    try {
      stopAllRecordings({ forceDiscard: true, skipDraftUpdate: true });
      Array.from(previewUrlsRef.current).forEach((url) => revokePreviewUrl(url));

      const response = isPreviewMode
        ? await api.homeworkGetAssignmentById(assignmentId)
        : await api.homeworkGetMyAssignmentById(assignmentId);
      const data = isPreviewMode
        ? buildPreviewAssignmentFromManageData(response?.data || {})
        : response?.data || null;
      setAssignment(data);

      const submissions = Array.isArray(data?.submissions) ? data.submissions : [];
      const byTask = {};
      submissions.forEach((submission) => {
        byTask[String(submission.task_id)] = createDraft(submission);
      });
      setDrafts(byTask);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load assignment detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(
    () => () => {
      stopAllRecordings({ forceDiscard: true, skipDraftUpdate: true });
      Array.from(previewUrlsRef.current).forEach((url) => revokePreviewUrl(url));
    },
    [],
  );

  useEffect(() => {
    if (!canAccessPage) {
      setLoading(false);
      return;
    }
    void loadAssignment();
  }, [assignmentId, isPreviewMode, canAccessPage]);

  const submissionsByTaskId = useMemo(() => {
    const map = new Map();
    (assignment?.submissions || []).forEach((submission) => {
      map.set(String(submission.task_id || ""), submission);
    });
    return map;
  }, [assignment?.submissions]);

  const isDeadlinePassed = useMemo(() => {
    const due = assignment?.due_date ? new Date(assignment.due_date) : null;
    if (!due || Number.isNaN(due.getTime())) return false;
    return Date.now() > due.getTime();
  }, [assignment?.due_date]);

  const updateDraft = (taskId, patch) =>
    setDrafts((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || createDraft()), ...patch },
    }));

  const handleSubmitTask = async (task) => {
    if (isPreviewMode) return;
    const taskId = String(task?._id || "");
    if (!taskId) return;

    const draft = drafts[taskId] || createDraft(submissionsByTaskId.get(taskId));
    if (draft.is_recording) {
      showNotification("Please stop recording before submitting", "error");
      return;
    }
    updateDraft(taskId, { submitting: true });

    try {
      const formData = new FormData();
      if (draft.text_answer !== undefined) {
        formData.append("text_answer", draft.text_answer || "");
      }
      (draft.image_files || []).forEach((file) => {
        formData.append("images", file);
      });
      if (draft.audio_file) {
        formData.append("audio", draft.audio_file);
      }

      await api.homeworkSubmitTask(assignmentId, taskId, formData);
      showNotification("Task submitted", "success");
      if (draft.audio_preview_url) {
        revokePreviewUrl(draft.audio_preview_url);
      }
      await loadAssignment();
      updateDraft(taskId, {
        image_files: [],
        audio_file: null,
        audio_preview_url: "",
        audio_error: "",
      });
    } catch (submitError) {
      showNotification(submitError?.message || "Failed to submit task", "error");
    } finally {
      updateDraft(taskId, { submitting: false });
    }
  };

  if (!canAccessPage) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">
            {isPreviewMode
              ? "Preview mode is only available for teacher/admin accounts."
              : "This page is only available for student accounts."}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">Loading assignment...</div>
        </div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">
            <p className="homework-danger">{error || "Assignment not found"}</p>
            <button
              type="button"
              className="homework-btn"
              onClick={() => navigate(isPreviewMode ? `/homework/assignments/${assignmentId}` : "/homework/my")}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="homework-page">
      <div className="homework-shell">
        <section className="homework-header">
          <div className="homework-title-wrap">
            <h1>{assignment.title || "Assignment"}</h1>
            <p>
              Week {assignment.week || "--"} - Due {formatDate(assignment.due_date)} - {assignment.month || "--"}
            </p>
          </div>
          <div className="homework-actions">
            <button type="button" className="homework-btn ghost" onClick={() => navigate("/")}>
              Home
            </button>
            <button
              type="button"
              className="homework-btn"
              onClick={() => navigate(isPreviewMode ? `/homework/assignments/${assignmentId}` : "/homework/my")}
            >
              Back
            </button>
          </div>
        </section>

        {isPreviewMode ? (
          <section className="homework-card">
            <p className="homework-item-meta">
              Preview mode: this page simulates student UI. Submit actions are disabled.
            </p>
          </section>
        ) : null}

        {isDeadlinePassed ? (
          <section className="homework-card">
            <p className="homework-danger">Deadline has passed. You can still review your submissions.</p>
          </section>
        ) : null}

        <section className="homework-card">
          <p className="homework-task-sub">{assignment.description || "No description provided."}</p>
        </section>

        <section className="homework-list">
          {(assignment.tasks || []).map((task, index) => {
            const taskId = String(task?._id || "");
            const submission = submissionsByTaskId.get(taskId);
            const draft = drafts[taskId] || createDraft(submission);
            const submitting = Boolean(draft.submitting);
            const canSubmit = !isDeadlinePassed && !isPreviewMode;
            const canInteract = !submitting && (!isDeadlinePassed || isPreviewMode);
            const inputType = resolveTaskInputType(task);
            const inputLabel = inputTypeToLabel(inputType);
            const hasTextInput = inputType === "text";
            const hasImageInput = inputType === "image";
            const hasAudioInput = inputType === "audio";

            return (
              <article key={taskId || `task-${index}`} className="homework-task-card">
                <div className="homework-task-head">
                  <h3>{task.title || `Task ${index + 1}`}</h3>
                  <span className="homework-chip">
                    {submission ? statusLabel(submission.status) : "Not submitted"}
                  </span>
                </div>

                <p className="homework-task-sub">{task.instruction || "No instruction"}</p>

                <div className="homework-chip-row">
                  {inputLabel ? <span className="homework-chip neutral">Requires {inputLabel}</span> : null}
                </div>

                {task.resource_mode === "internal" ? (
                  <p className="homework-item-meta">
                    Internal {task.resource_ref_type || "content"}: {task.resource_ref_id || "--"}
                  </p>
                ) : null}
                {(task.resource_mode === "external_url" || task.resource_mode === "uploaded") && task.resource_url ? (
                  <div className="space-y-2">
                    {(() => {
                      const preview = resolveVideoPreview(task.resource_url || "");
                      if (preview.kind === "youtube" && preview.youtubeId) {
                        return (
                          <div className="overflow-hidden rounded-md border homework-video-lite">
                            <LiteYouTubeEmbed
                              id={preview.youtubeId}
                              title={task.title || `Task ${index + 1} video`}
                              noCookie
                              adNetwork={false}
                              poster="maxresdefault"
                              params="cc_load_policy=0&iv_load_policy=3&modestbranding=1&rel=0"
                              webp
                            />
                          </div>
                        );
                      }
                      if (preview.kind === "vimeo") {
                        return (
                          <div className="overflow-hidden rounded-md border">
                            <iframe
                              src={preview.src}
                              title={task.title || `Task ${index + 1} video`}
                              className="aspect-video w-full"
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        );
                      }
                      if (preview.kind === "direct") {
                        return (
                          <div className="overflow-hidden rounded-md border">
                            <video controls className="aspect-video w-full" src={preview.src} />
                          </div>
                        );
                      }
                      return (
                        <p className="homework-item-meta">
                          Resource:{" "}
                          <a href={task.resource_url} target="_blank" rel="noreferrer">
                            Open link
                          </a>
                        </p>
                      );
                    })()}
                  </div>
                ) : null}

                <div className="homework-grid">
                  {hasTextInput ? (
                    <div className="homework-field homework-span-12">
                      <label>Text Answer</label>
                      <textarea
                        value={draft.text_answer || ""}
                        onChange={(event) => updateDraft(taskId, { text_answer: event.target.value })}
                        disabled={!canInteract}
                        placeholder={
                          task?.min_words || task?.max_words
                            ? `Type your answer here (${task.min_words || 0}-${task.max_words || "∞"} words)...`
                            : "Type your answer here..."
                        }
                      />
                    </div>
                  ) : null}

                  {hasImageInput ? (
                    <div className="homework-field homework-span-12">
                      <label>Images (max 5)</label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) =>
                          updateDraft(taskId, { image_files: Array.from(event.target.files || []) })
                        }
                        disabled={!canInteract}
                      />
                      {submission?.image_items?.length ? (
                        <p className="homework-item-meta">Current: {submission.image_items.length} image(s)</p>
                      ) : null}
                    </div>
                  ) : null}

                  {hasAudioInput ? (
                    <div className="homework-field homework-span-12">
                      <label>Audio Recording</label>
                      <div className="homework-audio-recorder">
                        <div className="homework-inline">
                          <button
                            type="button"
                            className={`homework-btn ${draft.is_recording ? "ghost" : "primary"}`}
                            onClick={() =>
                              draft.is_recording
                                ? stopAudioRecording(taskId)
                                : void startAudioRecording(taskId)
                            }
                            disabled={!canInteract || isPreviewMode}
                          >
                            {draft.is_recording ? "Stop recording" : "Start recording"}
                          </button>
                          <button
                            type="button"
                            className="homework-btn ghost"
                            onClick={() => clearDraftAudio(taskId)}
                            disabled={!canInteract || (!draft.audio_file && !draft.audio_preview_url)}
                          >
                            Clear
                          </button>
                        </div>
                        <p className="homework-item-meta">
                          Record directly in the browser. No audio file upload is required.
                        </p>
                        {draft.audio_error ? <p className="homework-danger">{draft.audio_error}</p> : null}
                        {draft.audio_preview_url ? (
                          <audio controls src={draft.audio_preview_url} style={{ width: "100%", marginTop: "0.4rem" }} />
                        ) : submission?.audio_item?.url ? (
                          <audio controls src={submission.audio_item.url} style={{ width: "100%", marginTop: "0.4rem" }} />
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="homework-task-actions">
                  <button
                    type="button"
                    className="homework-btn primary"
                    onClick={() => void handleSubmitTask(task)}
                    disabled={!canSubmit || submitting}
                  >
                    {isPreviewMode ? "Preview only" : submitting ? "Submitting..." : "Submit Task"}
                  </button>
                  {submission?.status === "graded" ? (
                    <span className="homework-chip">
                      Score: {submission?.score ?? "--"} / 10
                    </span>
                  ) : null}
                </div>

                {submission?.teacher_feedback ? (
                  <div className="homework-card">
                    <h4 className="homework-item-title" style={{ fontSize: "0.95rem" }}>Teacher Feedback</h4>
                    <p className="homework-task-sub">{submission.teacher_feedback}</p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
