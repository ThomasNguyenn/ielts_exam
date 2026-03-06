import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import { groupAssignmentsByMonth, monthLabel, toMonthValue } from "./homework.utils";
import "./Homework.css";

export default function MyHomeworkMonthPage() {
  const navigate = useNavigate();
  const user = api.getUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(toMonthValue());
  const [assignments, setAssignments] = useState([]);

  const loadAssignments = async (monthValue = month) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.homeworkGetMyAssignments({ month: monthValue });
      setAssignments(Array.isArray(response?.data) ? response.data : []);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load monthly homework");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssignments(month);
  }, []);

  const groupedAssignments = useMemo(
    () => groupAssignmentsByMonth(assignments),
    [assignments],
  );

  if (user?.role !== "student") {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">
            This page is for student view. Use teacher/admin routes for management.
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
            <h1>Bài Tập Tháng Của Tôi</h1>
            <p>Track monthly assignments and task completion progress.</p>
          </div>
          <div className="homework-actions">
            <input
              type="month"
              value={month}
              onChange={(event) => {
                const nextMonth = event.target.value;
                setMonth(nextMonth);
                void loadAssignments(nextMonth);
              }}
            />
          </div>
        </section>

        <section className="homework-card">
          {loading ? <p className="homework-item-meta">Loading assignments...</p> : null}
          {error ? <p className="homework-danger">{error}</p> : null}

          {!loading && !error && !groupedAssignments.length ? (
            <div className="homework-empty">No assignments found for this month.</div>
          ) : null}

          <div className="homework-list">
            {groupedAssignments.map((group) => (
              <article className="homework-item" key={group.month}>
                <h2 className="homework-item-title">{monthLabel(group.month)}</h2>
                <p className="homework-item-meta">{group.assignments.length} assignments</p>

                <div className="homework-list">
                  {group.assignments.map((assignment) => {
                    const submitted = Number(assignment?.progress?.submitted_tasks || 0);
                    const total = Number(assignment?.progress?.total_tasks || 0);
                    const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;
                    return (
                      <div className="homework-task-card" key={assignment?._id}>
                        <div className="homework-task-head">
                          <h3>{assignment?.title || "Assignment"}</h3>
                          <span className="homework-chip">Week {assignment?.week || "--"}</span>
                        </div>
                        <p className="homework-item-meta">{submitted}/{total} tasks submitted</p>
                        <div className="homework-progress-track">
                          <div className="homework-progress-fill" style={{ width: `${percent}%` }} />
                        </div>
                        <div className="homework-task-actions">
                          <button
                            type="button"
                            className="homework-btn"
                            onClick={() => navigate(`/student-ielts/homework/${assignment._id}`)}
                          >
                            Open Assignment
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

