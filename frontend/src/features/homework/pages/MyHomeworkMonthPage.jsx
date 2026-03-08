import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  USER_ROLE_STUDENT_ACA,
  isStudentFamilyRole,
  normalizeUserRole,
  studentAcaPath,
  studentIeltsPath,
} from "@/app/roleRouting";
import { api } from "@/shared/api/client";
import { groupAssignmentsByMonth, monthLabel, toMonthValue } from "./homework.utils";
import { CheckCircle2, BookOpen, MapPin } from "lucide-react";
import "./Homework.css";

export default function MyHomeworkMonthPage() {
  const navigate = useNavigate();
  const user = api.getUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(toMonthValue());
  const [assignments, setAssignments] = useState([]);
  const normalizedRole = normalizeUserRole(user?.role);
  const studentHomeworkBasePath =
    normalizedRole === USER_ROLE_STUDENT_ACA ? studentAcaPath("/homework") : studentIeltsPath("/homework");

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

  if (!isStudentFamilyRole(user?.role)) {
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
        <section className="mb-6 flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bài Tập Tháng Của Tôi</h1>
            <p className="text-sm text-muted-foreground">Track monthly assignments and task completion progress.</p>
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
                      <div
                        className="homework-task-card is-link"
                        key={assignment?._id}
                        onClick={() => navigate(`${studentHomeworkBasePath}/${assignment._id}`)}
                      >
                        <div className="homework-task-head">
                          <div className="homework-task-left">
                            <div className="homework-task-logo">
                              <BookOpen className="homework-task-icon" size={22} color="#4285F4" />
                            </div>
                            <div className="homework-task-title-wrap">
                              <h3>{assignment?.title || "Assignment"}</h3>
                              <p className="homework-task-subtitle">Week {assignment?.week || "--"}</p>
                            </div>
                          </div>
                          <div className={`homework-task-status-icon ${percent === 100 ? "submitted" : ""}`}>
                            <CheckCircle2 size={24} />
                          </div>
                        </div>

                        <div className="homework-task-footer">
                          <div className="homework-task-badges">
                            <span className="homework-task-badge">
                              <MapPin size={12} /> {total} Tasks
                            </span>
                            <span className="homework-task-badge">Homework</span>
                          </div>
                          <div className="homework-task-value" style={{ color: "#0f172a" }}>
                            {percent}%
                          </div>
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

