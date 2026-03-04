import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { clampScore, formatDate, statusLabel } from "./homework.utils";
import "./Homework.css";

export default function HomeworkSubmissionGradePage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadSubmission = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.homeworkGetSubmissionById(submissionId);
      const data = response?.data || null;
      setPayload(data);
      setScore(data?.score ?? "");
      setFeedback(data?.teacher_feedback || "");
    } catch (loadError) {
      setError(loadError?.message || "Failed to load submission");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSubmission();
  }, [submissionId]);

  const handleSave = async () => {
    const normalizedScore = clampScore(score);
    if (normalizedScore === "") {
      showNotification("Score must be between 0 and 10", "error");
      return;
    }

    setSaving(true);
    try {
      await api.homeworkGradeSubmission(submissionId, {
        score: normalizedScore,
        teacher_feedback: feedback,
      });
      showNotification("Grade saved", "success");
      void loadSubmission();
    } catch (saveError) {
      showNotification(saveError?.message || "Failed to save grade", "error");
    } finally {
      setSaving(false);
    }
  };

  const submission = payload || {};
  const assignment = submission.assignment || {};
  const student = submission.student || {};

  const canPlayAudio = useMemo(
    () => Boolean(submission?.audio_item?.url),
    [submission?.audio_item?.url],
  );

  if (loading) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">Loading submission...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">
            <p className="homework-danger">{error}</p>
            <button type="button" className="homework-btn" onClick={() => navigate(-1)}>
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
            <h1>Grade Submission</h1>
            <p>
              {assignment?.title || "Assignment"} • Student: {student?.name || "Unknown"} • Status:{" "}
              {statusLabel(submission?.status)}
            </p>
          </div>
          <div className="homework-actions">
            <button type="button" className="homework-btn ghost" onClick={() => navigate("/")}>
              Trang chủ
            </button>
            <button
              type="button"
              className="homework-btn ghost"
              onClick={() => navigate(`/homework/assignments/${assignment?._id}/dashboard`)}
            >
              Dashboard
            </button>
            <button type="button" className="homework-btn" onClick={() => navigate(-1)}>
              Back
            </button>
          </div>
        </section>

        <section className="homework-grid">
          <article className="homework-card homework-span-8">
            <h2 className="homework-item-title">Submission Content</h2>
            <p className="homework-item-meta">
              Submitted at {formatDate(submission?.submitted_at)} • Updated {formatDate(submission?.updatedAt)}
            </p>

            {submission?.text_answer ? (
              <div className="homework-card" style={{ marginTop: "0.7rem" }}>
                <h3 className="homework-item-title">Text Answer</h3>
                <p className="homework-task-sub">{submission.text_answer}</p>
              </div>
            ) : null}

            {Array.isArray(submission?.image_items) && submission.image_items.length > 0 ? (
              <div className="homework-card" style={{ marginTop: "0.7rem" }}>
                <h3 className="homework-item-title">Image Attachments</h3>
                <div className="homework-media-grid">
                  {submission.image_items.map((item) => (
                    <a href={item?.url} target="_blank" rel="noreferrer" key={item?.storage_key || item?.url}>
                      <img src={item?.url} alt="Submission" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {canPlayAudio ? (
              <div className="homework-card" style={{ marginTop: "0.7rem" }}>
                <h3 className="homework-item-title">Audio Attachment</h3>
                <audio controls src={submission.audio_item.url} style={{ width: "100%" }} />
                <p className="homework-item-meta">Type: {submission.audio_item?.mime || "audio"} </p>
              </div>
            ) : null}

            {!submission?.text_answer && !(submission?.image_items || []).length && !canPlayAudio ? (
              <div className="homework-empty">Submission has no content.</div>
            ) : null}
          </article>

          <article className="homework-card homework-span-4">
            <h2 className="homework-item-title">Grade</h2>
            <div className="homework-stacked">
              <div className="homework-field">
                <label>Score (0-10)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={10}
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                />
              </div>
              <div className="homework-field">
                <label>Feedback</label>
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Write actionable feedback for student..."
                />
              </div>
              <button type="button" className="homework-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Grade"}
              </button>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
