import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { formatDate, statusLabel } from "./homework.utils";
import "./Homework.css";

export default function HomeworkDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskData, setTaskData] = useState({ submissions: [], not_submitted_students: [] });

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.homeworkGetAssignmentDashboard(id);
      const data = response?.data || null;
      setDashboard(data);
      const firstTaskId = data?.tasks?.[0]?.task_id || "";
      setSelectedTaskId(firstTaskId ? String(firstTaskId) : "");
    } catch (loadError) {
      setError(loadError?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadTaskSubmissions = async (taskId) => {
    if (!taskId) {
      setTaskData({ submissions: [], not_submitted_students: [] });
      return;
    }

    setTaskLoading(true);
    try {
      const response = await api.homeworkGetTaskSubmissions(id, taskId);
      setTaskData({
        submissions: Array.isArray(response?.data?.submissions) ? response.data.submissions : [],
        not_submitted_students: Array.isArray(response?.data?.not_submitted_students)
          ? response.data.not_submitted_students
          : [],
      });
    } catch (taskError) {
      setTaskData({ submissions: [], not_submitted_students: [] });
      setError(taskError?.message || "Failed to load task submissions");
    } finally {
      setTaskLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [id]);

  useEffect(() => {
    if (!selectedTaskId) return;
    void loadTaskSubmissions(selectedTaskId);
  }, [selectedTaskId]);

  const currentTask = useMemo(
    () => (dashboard?.tasks || []).find((task) => String(task?.task_id || "") === String(selectedTaskId || "")),
    [dashboard?.tasks, selectedTaskId],
  );

  if (loading) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">
            <p className="homework-danger">{error}</p>
            <button type="button" className="homework-btn" onClick={() => navigate("/homework")}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totals = dashboard?.totals || {};
  const assignment = dashboard?.assignment || {};

  return (
    <div className="homework-page">
      <div className="homework-shell">
        <section className="homework-header">
          <div className="homework-title-wrap">
            <h1>Assignment Dashboard</h1>
            <p>
              {assignment?.title || "Assignment"} • Week {assignment?.week || "--"} • Due {formatDate(assignment?.due_date)}
            </p>
          </div>
          <div className="homework-actions">
            <button type="button" className="homework-btn ghost" onClick={() => navigate(`/homework/assignments/${id}`)}>
              View Assignment
            </button>
            <button type="button" className="homework-btn" onClick={() => navigate("/homework")}>
              Back
            </button>
          </div>
        </section>

        {error ? (
          <section className="homework-card">
            <p className="homework-danger">{error}</p>
          </section>
        ) : null}

        <section className="homework-card">
          <div className="homework-kpi-grid">
            <article className="homework-kpi">
              <span>Students In Target</span>
              <strong>{totals.students_in_target || 0}</strong>
            </article>
            <article className="homework-kpi">
              <span>Students In Scope</span>
              <strong>{totals.students_in_scope || 0}</strong>
            </article>
            <article className="homework-kpi">
              <span>Submitted Slots</span>
              <strong>{totals.submitted_total || 0}</strong>
            </article>
            <article className="homework-kpi">
              <span>Pending Slots</span>
              <strong>{totals.not_submitted_total || 0}</strong>
            </article>
          </div>
        </section>

        <section className="homework-grid">
          <article className="homework-card homework-span-6">
            <h2 className="homework-item-title">Task Summary</h2>
            <table className="homework-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Submitted</th>
                  <th>Not Submitted</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.tasks || []).map((task) => (
                  <tr key={String(task?.task_id || "")}>
                    <td>
                      <button
                        type="button"
                        className="homework-btn ghost"
                        style={{ padding: "0.3rem 0.5rem" }}
                        onClick={() => setSelectedTaskId(String(task?.task_id || ""))}
                      >
                        {task?.title || "Task"}
                      </button>
                    </td>
                    <td>{task?.submitted || 0}</td>
                    <td>{task?.not_submitted || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="homework-card homework-span-6">
            <h2 className="homework-item-title">Students</h2>
            <table className="homework-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status Snapshot</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.students || []).map((student) => {
                  const submittedCount = (student?.tasks || []).filter((task) => task.submitted).length;
                  return (
                    <tr key={student?._id}>
                      <td>{student?.name || "Student"}</td>
                      <td>{student?.email || "--"}</td>
                      <td>
                        {submittedCount}/{(student?.tasks || []).length || 0} submitted
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </article>
        </section>

        <section className="homework-card">
          <div className="homework-item-top">
            <h2 className="homework-item-title">
              Task Drilldown {currentTask ? `• ${currentTask.title}` : ""}
            </h2>
            <span className="homework-chip neutral">
              {currentTask ? statusLabel("submitted") : "Select task"}
            </span>
          </div>

          {taskLoading ? <p className="homework-item-meta">Loading task submissions...</p> : null}

          {!taskLoading && selectedTaskId ? (
            <div className="homework-grid">
              <article className="homework-span-8">
                <h3 className="homework-item-title">Submitted</h3>
                <table className="homework-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Submitted At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(taskData.submissions || []).map((submission) => (
                      <tr key={submission?._id}>
                        <td>{submission?.student?.name || submission?.student_id || "--"}</td>
                        <td>{statusLabel(submission?.status)}</td>
                        <td>{submission?.score ?? "--"}</td>
                        <td>{formatDate(submission?.submitted_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="homework-btn"
                            onClick={() => navigate(`/homework/submissions/${submission._id}`)}
                          >
                            Grade
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!taskData.submissions.length ? (
                      <tr>
                        <td colSpan={5}>No submissions yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </article>

              <article className="homework-span-4">
                <h3 className="homework-item-title">Not Submitted</h3>
                <div className="homework-list">
                  {(taskData.not_submitted_students || []).map((student) => (
                    <div className="homework-item" key={student?._id}>
                      <strong>{student?.name || "Student"}</strong>
                      <p className="homework-item-meta">{student?.email || "--"}</p>
                    </div>
                  ))}
                  {!taskData.not_submitted_students.length ? (
                    <div className="homework-empty">Everyone submitted for this task.</div>
                  ) : null}
                </div>
              </article>
            </div>
          ) : (
            <div className="homework-empty">Select a task to view submissions.</div>
          )}
        </section>
      </div>
    </div>
  );
}
