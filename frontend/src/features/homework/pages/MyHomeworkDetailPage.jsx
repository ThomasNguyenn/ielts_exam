import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  USER_ROLE_STUDENT_ACA,
  normalizeUserRole,
  studentAcaPath,
  studentIeltsPath,
} from "@/app/roleRouting";
import { api } from "@/shared/api/client";
import { formatDate } from "./homework.utils";
import { useHomeworkAssignmentDetail } from "./useHomeworkAssignmentDetail";
import { CheckCircle2, BookOpen, MapPin } from "lucide-react";
import "./Homework.css";

export default function MyHomeworkDetailPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const user = api.getUser();
  const {
    isPreviewMode,
    canAccessPage,
    loading,
    error,
    assignment,
    tasks,
    submissionsByTaskId,
  } = useHomeworkAssignmentDetail(assignmentId);

  const isDeadlinePassed = useMemo(() => {
    const due = assignment?.due_date ? new Date(assignment.due_date) : null;
    if (!due || Number.isNaN(due.getTime())) return false;
    return Date.now() > due.getTime();
  }, [assignment?.due_date]);

  const sectionGroups = useMemo(() => {
    const normalizeOrder = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

    const rawSections = Array.isArray(assignment?.sections) ? assignment.sections : [];
    const normalizedSections = rawSections
      .map((section, sectionIndex) => ({
        ...section,
        __sourceIndex: sectionIndex,
        __order: normalizeOrder(section?.order, sectionIndex),
      }))
      .sort((a, b) => (a.__order === b.__order ? a.__sourceIndex - b.__sourceIndex : a.__order - b.__order))
      .map((section, sectionIndex) => {
        const lessons = (Array.isArray(section?.lessons) ? section.lessons : [])
          .map((lesson, lessonIndex) => ({
            ...lesson,
            __sourceIndex: lessonIndex,
            __order: normalizeOrder(lesson?.order, lessonIndex),
          }))
          .sort((a, b) => (a.__order === b.__order ? a.__sourceIndex - b.__sourceIndex : a.__order - b.__order))
          .map(({ __sourceIndex, __order, ...lesson }) => lesson);

        const title = String(section?.name || section?.title || "").trim() || `Section ${sectionIndex + 1}`;
        return {
          _id: section?._id || `section-${sectionIndex}`,
          title,
          lessons,
        };
      })
      .filter((section) => section.lessons.length > 0);

    if (normalizedSections.length > 0) return normalizedSections;

    return tasks.length > 0
      ? [
          {
            _id: "section-fallback",
            title: "Lessons",
            lessons: tasks.map((task) => ({
              _id: task?._id,
              name: task?.title || "",
              title: task?.title || "",
              instruction: task?.instruction || "",
            })),
          },
        ]
      : [];
  }, [assignment?.sections, tasks]);

  const normalizedRole = normalizeUserRole(user?.role);
  const studentHomeworkBasePath =
    normalizedRole === USER_ROLE_STUDENT_ACA ? studentAcaPath("/homework") : studentIeltsPath("/homework");
  const backToMonthPath = studentHomeworkBasePath;
  const previewQuery = isPreviewMode ? "?preview=1" : "";

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
              onClick={() => navigate(isPreviewMode ? `/homework/assignments/${assignmentId}` : backToMonthPath)}
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
            <button type="button" className="homework-btn" onClick={() => navigate(backToMonthPath)}>
              Month
            </button>
          </div>
        </section>

        {isPreviewMode ? (
          <section className="homework-card">
            <p className="homework-item-meta">
              Preview mode: open a lesson to see the student lesson page.
            </p>
          </section>
        ) : null}

        {isDeadlinePassed ? (
          <section className="homework-card">
            <p className="homework-danger">Deadline has passed. You can still review your submissions.</p>
          </section>
        ) : null}
        
        <section className="homework-list">
          {sectionGroups.length === 0 ? (
            <div className="homework-empty">No lessons found for this assignment.</div>
          ) : null}

          {sectionGroups.map((section, sectionIndex) => (
            <article key={String(section?._id || `section-${sectionIndex}`)} className="homework-item">
              <h3 className="homework-item-title">{section.title}</h3>
              <p className="homework-item-meta">{section.lessons.length} lessons</p>

              <div className="homework-list">
                {section.lessons.map((lesson, lessonIndex) => {
                  const taskId = String(lesson?._id || "");
                  const submission = submissionsByTaskId.get(taskId);
                  const lessonTitle =
                    String(lesson?.name || lesson?.title || "").trim() || `Lesson ${lessonIndex + 1}`;
                  const instructionPreview = String(lesson?.instruction || "").trim();

                  return (
                    <article
                      key={taskId || `task-${sectionIndex}-${lessonIndex}`}
                      className="homework-task-card is-link"
                      onClick={() => {
                        if (taskId) {
                          navigate(`${studentHomeworkBasePath}/${assignmentId}/lessons/${taskId}${previewQuery}`);
                        }
                      }}
                    >
                      <div className="homework-task-head">
                        <div className="homework-task-left">
                          <div className="homework-task-logo">
                            <BookOpen className="homework-task-icon" size={22} color="#4285F4" />
                          </div>
                          <div className="homework-task-title-wrap">
                            <h3>{lessonTitle}</h3>
                            <p className="homework-task-subtitle">{section.title}</p>
                          </div>
                        </div>
                        <div className={`homework-task-status-icon ${submission ? "submitted" : ""}`}>
                          <CheckCircle2 size={24} />
                        </div>
                      </div>

                      <div className="homework-task-footer">
                        <div className="homework-task-badges">
                          <span className="homework-task-badge">
                            <MapPin size={12} /> Task
                          </span>
                          <span className="homework-task-badge">Required</span>
                        </div>
                        <div className="homework-task-value text-primary font-bold">
                          Open ➔
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
