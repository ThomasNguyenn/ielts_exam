import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { formatDate, statusLabel, toMonthValue } from "./homework.utils";
import "./Homework.css";

const STATUS_OPTIONS = ["all", "draft", "published", "archived"];
const OWNER_OPTIONS = ["all", "me"];

export default function HomeworkAssignmentsPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const user = api.getUser();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    month: toMonthValue(),
    status: "all",
    owner: user?.role === "teacher" ? "me" : "all",
    page: 1,
  });

  const loadAssignments = async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page: nextFilters.page || 1,
        limit: 20,
      };
      if (nextFilters.month) params.month = nextFilters.month;
      if (nextFilters.status && nextFilters.status !== "all") params.status = nextFilters.status;
      if (nextFilters.owner && nextFilters.owner !== "all") params.owner = nextFilters.owner;

      const response = await api.homeworkGetAssignments(params);
      setItems(Array.isArray(response?.data) ? response.data : []);
      setPagination(response?.pagination || { page: 1, limit: 20, totalItems: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError?.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssignments(filters);
  }, []);

  const updateFilters = (patch) => {
    const next = { ...filters, ...patch, page: 1 };
    setFilters(next);
    void loadAssignments(next);
  };

  const handleDelete = async (assignmentId) => {
    const confirmed = window.confirm("Delete this assignment and all submissions?");
    if (!confirmed) return;

    try {
      await api.homeworkDeleteAssignment(assignmentId);
      showNotification("Assignment deleted", "success");
      void loadAssignments(filters);
    } catch (deleteError) {
      showNotification(deleteError?.message || "Failed to delete assignment", "error");
    }
  };

  const canCreate = user?.role === "admin" || user?.role === "teacher";
  const assignmentCountLabel = useMemo(() => {
    const total = Number(pagination?.totalItems || items.length || 0);
    return `${total} assignment${total === 1 ? "" : "s"}`;
  }, [items.length, pagination?.totalItems]);

  return (
    <div className="homework-page">
      <div className="homework-shell">
        <section className="homework-header">
          <div className="homework-title-wrap">
            <h1>Bài Tập Tháng</h1>
            <p>Teacher/Admin workspace for monthly assignments, resources, and grading dashboard.</p>
          </div>
          <div className="homework-actions">
            <button type="button" className="homework-btn ghost" onClick={() => navigate("/")}>
              Trang chủ
            </button>
            <button type="button" className="homework-btn ghost" onClick={() => navigate("/homework/groups")}>
              Manage Groups
            </button>
            {canCreate ? (
              <button
                type="button"
                className="homework-btn primary"
                onClick={() => navigate("/homework/assignments/new")}
              >
                New Assignment
              </button>
            ) : null}
          </div>
        </section>

        <section className="homework-card">
          <div className="homework-filter-row">
            <div className="homework-field">
              <label>Month</label>
              <input
                type="month"
                value={filters.month || ""}
                onChange={(event) => updateFilters({ month: event.target.value })}
              />
            </div>
            <div className="homework-field">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(event) => updateFilters({ status: event.target.value })}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All" : statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <div className="homework-field">
              <label>Owner</label>
              <select
                value={filters.owner}
                onChange={(event) => updateFilters({ owner: event.target.value })}
              >
                {OWNER_OPTIONS.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner === "all" ? "All" : "My assignments"}
                  </option>
                ))}
              </select>
            </div>
            <div className="homework-field">
              <label>&nbsp;</label>
              <button type="button" className="homework-btn" onClick={() => void loadAssignments(filters)}>
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="homework-card">
          <div className="homework-item-top">
            <p className="homework-item-meta">{assignmentCountLabel}</p>
          </div>

          {loading ? <p className="homework-item-meta">Loading assignments...</p> : null}
          {error ? <p className="homework-danger">{error}</p> : null}

          {!loading && !error && items.length === 0 ? (
            <div className="homework-empty">No assignments found for current filters.</div>
          ) : null}

          <div className="homework-list">
            {items.map((assignment) => (
              <article className="homework-item" key={assignment._id}>
                <div className="homework-item-top">
                  <div>
                    <h2 className="homework-item-title">{assignment.title || "Untitled assignment"}</h2>
                    <p className="homework-item-meta">
                      Week {assignment.week || "--"} • Due {formatDate(assignment.due_date)}
                    </p>
                  </div>
                  <div className="homework-chip-row">
                    <span className="homework-chip">{statusLabel(assignment.status)}</span>
                    <span className="homework-chip neutral">{assignment.month || "--"}</span>
                  </div>
                </div>
                <div className="homework-chip-row">
                  {(assignment.target_group_ids || []).map((group) => (
                    <span className="homework-chip neutral" key={group?._id || `${assignment._id}-${group?.name || "group"}`}>
                      {group?.name || "Group"}
                    </span>
                  ))}
                </div>

                <div className="homework-task-actions">
                  <button
                    type="button"
                    className="homework-btn"
                    onClick={() => navigate(`/homework/assignments/${assignment._id}`)}
                  >
                    {assignment.can_manage ? "Edit" : "View"}
                  </button>
                  <button
                    type="button"
                    className="homework-btn ghost"
                    onClick={() => navigate(`/homework/assignments/${assignment._id}/dashboard`)}
                  >
                    Dashboard
                  </button>
                  {assignment.can_manage ? (
                    <button
                      type="button"
                      className="homework-btn"
                      onClick={() => handleDelete(assignment._id)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
