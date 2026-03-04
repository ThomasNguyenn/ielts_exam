import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import "./Homework.css";

const createEmptyForm = () => ({
  _id: "",
  name: "",
  description: "",
  level_label: "",
  student_ids: [],
});

export default function HomeworkGroupsPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [form, setForm] = useState(createEmptyForm);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [groupRes, studentsRes] = await Promise.all([
        api.homeworkGetGroups({ include_inactive: true, limit: 100 }),
        api.getUsers({ role: "student", limit: 500, page: 1 }),
      ]);
      setGroups(Array.isArray(groupRes?.data) ? groupRes.data : []);
      setStudents(Array.isArray(studentsRes?.data) ? studentsRes.data : []);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredStudents = useMemo(() => {
    const q = String(studentSearch || "").trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) =>
      String(student?.name || "").toLowerCase().includes(q) ||
      String(student?.email || "").toLowerCase().includes(q),
    );
  }, [students, studentSearch]);

  const isEditing = Boolean(form._id);

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const toggleStudent = (studentId) => {
    setForm((prev) => {
      const id = String(studentId || "");
      const selected = new Set((prev.student_ids || []).map(String));
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return {
        ...prev,
        student_ids: Array.from(selected),
      };
    });
  };

  const resetForm = () => setForm(createEmptyForm());

  const handleSave = async () => {
    if (!String(form.name || "").trim()) {
      showNotification("Group name is required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: String(form.name || "").trim(),
        description: String(form.description || "").trim(),
        level_label: String(form.level_label || "").trim(),
        student_ids: form.student_ids,
      };

      if (isEditing) {
        await api.homeworkUpdateGroup(form._id, payload);
        showNotification("Group updated", "success");
      } else {
        await api.homeworkCreateGroup(payload);
        showNotification("Group created", "success");
      }

      resetForm();
      void loadData();
    } catch (saveError) {
      showNotification(saveError?.message || "Failed to save group", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (groupId) => {
    const confirmed = window.confirm("Archive this group?");
    if (!confirmed) return;

    try {
      await api.homeworkDeleteGroup(groupId);
      showNotification("Group archived", "success");
      if (String(form._id) === String(groupId)) resetForm();
      void loadData();
    } catch (deleteError) {
      showNotification(deleteError?.message || "Failed to archive group", "error");
    }
  };

  const selectGroup = (group) => {
    setForm({
      _id: group?._id || "",
      name: group?.name || "",
      description: group?.description || "",
      level_label: group?.level_label || "",
      student_ids: Array.isArray(group?.student_ids)
        ? group.student_ids.map((studentId) => String(studentId))
        : [],
    });
  };

  return (
    <div className="homework-page">
      <div className="homework-shell">
        <section className="homework-header">
          <div className="homework-title-wrap">
            <h1>Homework Groups</h1>
            <p>Create and manage student groups used to target monthly assignments.</p>
          </div>
          <div className="homework-actions">
            <button type="button" className="homework-btn ghost" onClick={() => navigate("/")}>
              Trang chủ
            </button>
            <button type="button" className="homework-btn ghost" onClick={() => navigate("/homework")}>
              Back to Assignments
            </button>
          </div>
        </section>

        <section className="homework-grid">
          <article className="homework-card homework-span-4">
            <div className="homework-item-top">
              <h2 className="homework-item-title">{isEditing ? "Edit Group" : "New Group"}</h2>
            </div>

            <div className="homework-stacked">
              <div className="homework-field">
                <label>Name</label>
                <input
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                  placeholder="e.g. Grade 11 - Team A"
                />
              </div>
              <div className="homework-field">
                <label>Level Label</label>
                <input
                  value={form.level_label}
                  onChange={(event) => updateForm({ level_label: event.target.value })}
                  placeholder="B1 / B2 / C1..."
                />
              </div>
              <div className="homework-field">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => updateForm({ description: event.target.value })}
                  placeholder="Describe this group scope..."
                />
              </div>
              <div className="homework-field">
                <label>Students ({form.student_ids.length})</label>
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search student..."
                />
                <div style={{ maxHeight: "260px", overflow: "auto", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.45rem" }}>
                  {filteredStudents.map((student) => {
                    const studentId = String(student?._id || "");
                    const checked = form.student_ids.includes(studentId);
                    return (
                      <label key={studentId} className="homework-inline" style={{ width: "100%", marginBottom: "0.35rem" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudent(studentId)}
                        />
                        <span>{student?.name || "Student"} ({student?.email || "no-email"})</span>
                      </label>
                    );
                  })}
                  {!filteredStudents.length ? <p className="homework-item-meta">No students found.</p> : null}
                </div>
              </div>
              <div className="homework-task-actions">
                <button type="button" className="homework-btn primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : isEditing ? "Update Group" : "Create Group"}
                </button>
                <button type="button" className="homework-btn" onClick={resetForm}>
                  Reset
                </button>
              </div>
            </div>
          </article>

          <article className="homework-card homework-span-8">
            <div className="homework-item-top">
              <h2 className="homework-item-title">Existing Groups</h2>
            </div>
            {loading ? <p className="homework-item-meta">Loading groups...</p> : null}
            {error ? <p className="homework-danger">{error}</p> : null}

            {!loading && !error && !groups.length ? (
              <div className="homework-empty">No groups yet.</div>
            ) : (
              <div className="homework-list">
                {groups.map((group) => (
                  <article className="homework-item" key={group._id}>
                    <div className="homework-item-top">
                      <div>
                        <h3 className="homework-item-title">{group.name}</h3>
                        <p className="homework-item-meta">
                          {group.level_label || "No level"} • {(group.student_ids || []).length} students
                        </p>
                      </div>
                      <span className={`homework-chip ${group.is_active ? "" : "neutral"}`}>
                        {group.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="homework-item-meta">{group.description || "No description"}</p>
                    <div className="homework-task-actions">
                      <button type="button" className="homework-btn" onClick={() => selectGroup(group)}>
                        Edit
                      </button>
                      <button type="button" className="homework-btn" onClick={() => handleDelete(group._id)}>
                        Archive
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      </div>
    </div>
  );
}
