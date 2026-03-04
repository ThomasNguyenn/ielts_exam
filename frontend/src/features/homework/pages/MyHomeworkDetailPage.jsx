import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { formatDate, statusLabel } from "./homework.utils";
import "./Homework.css";

const createDraft = (submission = {}) => ({
  text_answer: submission?.text_answer || "",
  image_files: [],
  audio_file: null,
  submitting: false,
});

export default function MyHomeworkDetailPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const user = api.getUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignment, setAssignment] = useState(null);
  const [drafts, setDrafts] = useState({});

  const loadAssignment = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.homeworkGetMyAssignmentById(assignmentId);
      const data = response?.data || null;
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

  useEffect(() => {
    void loadAssignment();
  }, [assignmentId]);

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
    const taskId = String(task?._id || "");
    if (!taskId) return;

    const draft = drafts[taskId] || createDraft(submissionsByTaskId.get(taskId));
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
      await loadAssignment();
      updateDraft(taskId, {
        image_files: [],
        audio_file: null,
      });
    } catch (submitError) {
      showNotification(submitError?.message || "Failed to submit task", "error");
    } finally {
      updateDraft(taskId, { submitting: false });
    }
  };

  if (user?.role !== "student") {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">This page is only available for student accounts.</div>
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
            <button type="button" className="homework-btn" onClick={() => navigate("/homework/my")}>
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
              Week {assignment.week || "--"} • Due {formatDate(assignment.due_date)} • {assignment.month || "--"}
            </p>
          </div>
          <div className="homework-actions">
            <button type="button" className="homework-btn" onClick={() => navigate("/homework/my")}>
              Back
            </button>
          </div>
        </section>

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
            const canSubmit = !isDeadlinePassed;

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
                  {task.requires_text ? <span className="homework-chip neutral">Requires text</span> : null}
                  {task.requires_image ? <span className="homework-chip neutral">Requires image</span> : null}
                  {task.requires_audio ? <span className="homework-chip neutral">Requires audio</span> : null}
                </div>

                {task.resource_mode === "internal" ? (
                  <p className="homework-item-meta">
                    Internal {task.resource_ref_type || "content"}: {task.resource_ref_id || "--"}
                  </p>
                ) : null}
                {(task.resource_mode === "external_url" || task.resource_mode === "uploaded") && task.resource_url ? (
                  <p className="homework-item-meta">
                    Resource:{" "}
                    <a href={task.resource_url} target="_blank" rel="noreferrer">
                      Open link
                    </a>
                  </p>
                ) : null}

                <div className="homework-grid">
                  <div className="homework-field homework-span-12">
                    <label>Text Answer</label>
                    <textarea
                      value={draft.text_answer || ""}
                      onChange={(event) => updateDraft(taskId, { text_answer: event.target.value })}
                      disabled={!canSubmit || submitting}
                      placeholder="Type your answer here..."
                    />
                  </div>
                  <div className="homework-field homework-span-6">
                    <label>Images (max 5)</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        updateDraft(taskId, { image_files: Array.from(event.target.files || []) })
                      }
                      disabled={!canSubmit || submitting}
                    />
                    {submission?.image_items?.length ? (
                      <p className="homework-item-meta">Current: {submission.image_items.length} image(s)</p>
                    ) : null}
                  </div>
                  <div className="homework-field homework-span-6">
                    <label>Audio</label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(event) =>
                        updateDraft(taskId, { audio_file: event.target.files?.[0] || null })
                      }
                      disabled={!canSubmit || submitting}
                    />
                    {submission?.audio_item?.url ? (
                      <audio controls src={submission.audio_item.url} style={{ width: "100%", marginTop: "0.4rem" }} />
                    ) : null}
                  </div>
                </div>

                <div className="homework-task-actions">
                  <button
                    type="button"
                    className="homework-btn primary"
                    onClick={() => void handleSubmitTask(task)}
                    disabled={!canSubmit || submitting}
                  >
                    {submitting ? "Submitting..." : "Submit Task"}
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
