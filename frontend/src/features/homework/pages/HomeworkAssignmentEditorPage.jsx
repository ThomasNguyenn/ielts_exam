import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { normalizeTaskForSubmit, toMonthValue } from "./homework.utils";
import "./Homework.css";

const createTask = (index = 0) => ({
  _id: "",
  type: "custom_task",
  title: "",
  instruction: "",
  order: index,
  resource_mode: "internal",
  resource_ref_type: "passage",
  resource_ref_id: "",
  resource_url: "",
  resource_storage_key: "",
  requires_text: true,
  requires_image: false,
  requires_audio: false,
  min_words: "",
  max_words: "",
});

const createForm = () => ({
  title: "",
  description: "",
  month: toMonthValue(),
  week: 1,
  due_date: "",
  status: "draft",
  target_group_ids: [],
  tasks: [createTask(0)],
});

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function HomeworkAssignmentEditorPage() {
  const { id } = useParams();
  const editId = id && id !== "new" ? id : null;
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const fileInputRefs = useRef(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingTaskIndex, setUploadingTaskIndex] = useState(-1);
  const [error, setError] = useState("");
  const [canManage, setCanManage] = useState(true);
  const [form, setForm] = useState(createForm);
  const [searchByTask, setSearchByTask] = useState({});
  const [groups, setGroups] = useState([]);
  const [catalog, setCatalog] = useState({
    passage: [],
    section: [],
    speaking: [],
    writing: [],
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [groupsRes, passageRes, sectionRes, speakingRes, writingRes, assignmentRes] = await Promise.all([
        api.homeworkGetGroups({ limit: 200 }),
        api.getPassages(),
        api.getSections(),
        api.getSpeakings({ limit: 200 }),
        api.getWritings(),
        editId ? api.homeworkGetAssignmentById(editId) : Promise.resolve(null),
      ]);

      setGroups(Array.isArray(groupsRes?.data) ? groupsRes.data.filter((group) => group?.is_active !== false) : []);
      setCatalog({
        passage: Array.isArray(passageRes?.data) ? passageRes.data : [],
        section: Array.isArray(sectionRes?.data) ? sectionRes.data : [],
        speaking: Array.isArray(speakingRes?.data) ? speakingRes.data : [],
        writing: Array.isArray(writingRes?.data) ? writingRes.data : [],
      });

      if (assignmentRes?.data) {
        const assignment = assignmentRes.data;
        setCanManage(Boolean(assignment.can_manage));
        setForm({
          title: assignment.title || "",
          description: assignment.description || "",
          month: assignment.month || toMonthValue(),
          week: Number(assignment.week || 1),
          due_date: toDateInputValue(assignment.due_date),
          status: assignment.status || "draft",
          target_group_ids: Array.isArray(assignment.target_group_ids)
            ? assignment.target_group_ids.map((group) => String(group?._id || group))
            : [],
          tasks: Array.isArray(assignment.tasks) && assignment.tasks.length
            ? assignment.tasks.map((task, index) => ({
              _id: task?._id || "",
              type: task?.type || "custom_task",
              title: task?.title || "",
              instruction: task?.instruction || "",
              order: Number.isFinite(Number(task?.order)) ? Number(task.order) : index,
              resource_mode: task?.resource_mode || "internal",
              resource_ref_type: task?.resource_ref_type || "passage",
              resource_ref_id: task?.resource_ref_id || "",
              resource_url: task?.resource_url || "",
              resource_storage_key: task?.resource_storage_key || "",
              requires_text: Boolean(task?.requires_text),
              requires_image: Boolean(task?.requires_image),
              requires_audio: Boolean(task?.requires_audio),
              min_words: task?.min_words ?? "",
              max_words: task?.max_words ?? "",
            }))
            : [createTask(0)],
        });
      } else {
        setCanManage(true);
        setForm(createForm());
      }
    } catch (loadError) {
      setError(loadError?.message || "Failed to load editor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [editId]);

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const updateTask = (taskIndex, patch) => {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task, index) => (index === taskIndex ? { ...task, ...patch } : task)),
    }));
  };

  const toggleGroup = (groupId) => {
    setForm((prev) => {
      const selected = new Set((prev.target_group_ids || []).map(String));
      const normalized = String(groupId || "");
      if (selected.has(normalized)) selected.delete(normalized);
      else selected.add(normalized);
      return { ...prev, target_group_ids: Array.from(selected) };
    });
  };

  const addTask = () =>
    setForm((prev) => ({
      ...prev,
      tasks: [...prev.tasks, createTask(prev.tasks.length)],
    }));

  const removeTask = (taskIndex) =>
    setForm((prev) => {
      const nextTasks = prev.tasks.filter((_, index) => index !== taskIndex);
      return {
        ...prev,
        tasks: nextTasks.length ? nextTasks : [createTask(0)],
      };
    });

  const getCatalogItems = (task) => {
    const refType = String(task?.resource_ref_type || "passage");
    return catalog[refType] || [];
  };

  const getResourceDisplayLabel = (task) => {
    if (!task?.resource_ref_id) return "";
    const list = getCatalogItems(task);
    const found = list.find((item) => String(item?._id || "") === String(task.resource_ref_id));
    if (!found) return task.resource_ref_id;
    return `${found.title || found._id} (${found._id})`;
  };

  const handleResourceUploadClick = (taskIndex) => {
    const input = fileInputRefs.current.get(taskIndex);
    input?.click?.();
  };

  const handleResourceUploadSelected = async (taskIndex, event) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    setUploadingTaskIndex(taskIndex);
    try {
      const formData = new FormData();
      formData.append("resource", file);
      formData.append("assignment_id", editId || "temp-assignment");
      formData.append("task_id", form.tasks[taskIndex]?._id || `task-${taskIndex + 1}`);
      const response = await api.uploadHomeworkResource(formData);

      const url = response?.data?.url || "";
      const key = response?.data?.key || "";
      if (!url || !key) {
        throw new Error("Upload response missing url/key");
      }

      updateTask(taskIndex, {
        resource_mode: "uploaded",
        resource_url: url,
        resource_storage_key: key,
      });
      showNotification("Resource uploaded successfully", "success");
    } catch (uploadError) {
      showNotification(uploadError?.message || "Failed to upload resource", "error");
    } finally {
      setUploadingTaskIndex(-1);
      if (event?.target) event.target.value = "";
    }
  };

  const validateBeforeSubmit = () => {
    if (!String(form.title || "").trim()) return "Title is required";
    if (!String(form.month || "").trim()) return "Month is required";
    if (!String(form.due_date || "").trim()) return "Due date is required";
    if (!Array.isArray(form.target_group_ids) || form.target_group_ids.length === 0) {
      return "Select at least one target group";
    }
    if (!Array.isArray(form.tasks) || form.tasks.length === 0) return "At least one task is required";
    return "";
  };

  const handleSave = async () => {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      showNotification(validationError, "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: String(form.title || "").trim(),
        description: String(form.description || "").trim(),
        month: form.month,
        week: Number(form.week || 1),
        due_date: form.due_date,
        status: form.status || "draft",
        target_group_ids: form.target_group_ids,
        tasks: form.tasks.map((task, index) => normalizeTaskForSubmit(task, index)),
      };

      if (editId) {
        await api.homeworkUpdateAssignment(editId, payload);
        showNotification("Assignment updated", "success");
      } else {
        const created = await api.homeworkCreateAssignment(payload);
        showNotification("Assignment created", "success");
        const newId = created?.data?._id;
        if (newId) {
          navigate(`/homework/assignments/${newId}`);
          return;
        }
      }
      void loadData();
    } catch (saveError) {
      showNotification(saveError?.message || "Failed to save assignment", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusPatch = async (nextStatus) => {
    if (!editId) {
      updateForm({ status: nextStatus });
      return;
    }

    try {
      await api.homeworkUpdateAssignmentStatus(editId, nextStatus);
      updateForm({ status: nextStatus });
      showNotification("Status updated", "success");
    } catch (statusError) {
      showNotification(statusError?.message || "Failed to update status", "error");
    }
  };

  if (loading) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">Loading editor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="homework-page">
      <div className="homework-shell">
        <section className="homework-header">
          <div className="homework-title-wrap">
            <h1>{editId ? "Edit Monthly Assignment" : "Create Monthly Assignment"}</h1>
            <p>Build dynamic tasks and link internal resources from passage/section/speaking/writing content.</p>
          </div>
          <div className="homework-actions">
            <button type="button" className="homework-btn ghost" onClick={() => navigate("/homework")}>
              Back
            </button>
            <button
              type="button"
              className="homework-btn primary"
              onClick={handleSave}
              disabled={saving || !canManage}
            >
              {saving ? "Saving..." : "Save Assignment"}
            </button>
          </div>
        </section>

        {error ? <section className="homework-card"><p className="homework-danger">{error}</p></section> : null}
        {!canManage ? (
          <section className="homework-card">
            <p className="homework-danger">You can view this assignment but cannot edit it.</p>
          </section>
        ) : null}

        <section className="homework-grid">
          <article className="homework-card homework-span-8">
            <div className="homework-stacked">
              <div className="homework-field">
                <label>Title</label>
                <input
                  value={form.title}
                  onChange={(event) => updateForm({ title: event.target.value })}
                  placeholder="Monthly homework title"
                  disabled={!canManage}
                />
              </div>
              <div className="homework-field">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => updateForm({ description: event.target.value })}
                  placeholder="Describe assignment goals..."
                  disabled={!canManage}
                />
              </div>

              <div className="homework-grid">
                <div className="homework-field homework-span-4">
                  <label>Month</label>
                  <input
                    type="month"
                    value={form.month}
                    onChange={(event) => updateForm({ month: event.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="homework-field homework-span-4">
                  <label>Week</label>
                  <select
                    value={form.week}
                    onChange={(event) => updateForm({ week: Number(event.target.value) })}
                    disabled={!canManage}
                  >
                    {[1, 2, 3, 4, 5].map((weekValue) => (
                      <option key={weekValue} value={weekValue}>
                        Week {weekValue}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="homework-field homework-span-4">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(event) => updateForm({ due_date: event.target.value })}
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div className="homework-field">
                <label>Status</label>
                <div className="homework-task-actions">
                  {["draft", "published", "archived"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`homework-btn ${form.status === status ? "primary" : ""}`}
                      onClick={() => handleStatusPatch(status)}
                      disabled={!canManage}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="homework-card homework-span-4">
            <h2 className="homework-item-title">Target Groups</h2>
            <p className="homework-item-meta">Select one or more groups for this assignment.</p>
            <div style={{ maxHeight: "320px", overflow: "auto", marginTop: "0.65rem" }}>
              {groups.map((group) => {
                const checked = form.target_group_ids.includes(String(group._id));
                return (
                  <label key={group._id} className="homework-inline" style={{ width: "100%", marginBottom: "0.45rem" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroup(group._id)}
                      disabled={!canManage}
                    />
                    <span>{group.name} ({(group.student_ids || []).length || 0} students)</span>
                  </label>
                );
              })}
              {!groups.length ? <p className="homework-item-meta">No groups yet.</p> : null}
            </div>
          </article>
        </section>

        <section className="homework-card">
          <div className="homework-item-top">
            <h2 className="homework-item-title">Tasks</h2>
            <button type="button" className="homework-btn primary" onClick={addTask} disabled={!canManage}>
              Add Task
            </button>
          </div>

          <div className="homework-list">
            {form.tasks.map((task, taskIndex) => {
              const searchKeyword = searchByTask[taskIndex] || "";
              const resourceItems = getCatalogItems(task);
              const filteredItems = resourceItems.filter((item) =>
                String(item?.title || item?._id || "").toLowerCase().includes(searchKeyword.toLowerCase()),
              );

              return (
                <article className="homework-task-card" key={task._id || `task-${taskIndex}`}>
                  <div className="homework-task-head">
                    <h3>Task {taskIndex + 1}</h3>
                    <button
                      type="button"
                      className="homework-btn"
                      onClick={() => removeTask(taskIndex)}
                      disabled={!canManage}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="homework-grid">
                    <div className="homework-field homework-span-4">
                      <label>Type</label>
                      <input
                        value={task.type}
                        onChange={(event) => updateTask(taskIndex, { type: event.target.value })}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="homework-field homework-span-8">
                      <label>Title</label>
                      <input
                        value={task.title}
                        onChange={(event) => updateTask(taskIndex, { title: event.target.value })}
                        disabled={!canManage}
                      />
                    </div>
                  </div>

                  <div className="homework-field">
                    <label>Instruction</label>
                    <textarea
                      value={task.instruction}
                      onChange={(event) => updateTask(taskIndex, { instruction: event.target.value })}
                      disabled={!canManage}
                    />
                  </div>

                  <div className="homework-grid">
                    <div className="homework-field homework-span-4">
                      <label>Resource Mode</label>
                      <select
                        value={task.resource_mode}
                        onChange={(event) => updateTask(taskIndex, { resource_mode: event.target.value })}
                        disabled={!canManage}
                      >
                        <option value="internal">Internal content</option>
                        <option value="external_url">External URL</option>
                        <option value="uploaded">Uploaded file</option>
                      </select>
                    </div>
                    <div className="homework-field homework-span-4">
                      <label>Order</label>
                      <input
                        type="number"
                        value={task.order}
                        onChange={(event) => updateTask(taskIndex, { order: Number(event.target.value) })}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="homework-field homework-span-4">
                      <label>Requirement</label>
                      <div className="homework-chip-row">
                        <label className="homework-inline">
                          <input
                            type="checkbox"
                            checked={Boolean(task.requires_text)}
                            onChange={(event) => updateTask(taskIndex, { requires_text: event.target.checked })}
                            disabled={!canManage}
                          />
                          <span>Text</span>
                        </label>
                        <label className="homework-inline">
                          <input
                            type="checkbox"
                            checked={Boolean(task.requires_image)}
                            onChange={(event) => updateTask(taskIndex, { requires_image: event.target.checked })}
                            disabled={!canManage}
                          />
                          <span>Image</span>
                        </label>
                        <label className="homework-inline">
                          <input
                            type="checkbox"
                            checked={Boolean(task.requires_audio)}
                            onChange={(event) => updateTask(taskIndex, { requires_audio: event.target.checked })}
                            disabled={!canManage}
                          />
                          <span>Audio</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {task.resource_mode === "internal" ? (
                    <div className="homework-stacked">
                      <div className="homework-grid">
                        <div className="homework-field homework-span-4">
                          <label>Internal Type</label>
                          <select
                            value={task.resource_ref_type || "passage"}
                            onChange={(event) =>
                              updateTask(taskIndex, {
                                resource_ref_type: event.target.value,
                                resource_ref_id: "",
                              })}
                            disabled={!canManage}
                          >
                            <option value="passage">Passage</option>
                            <option value="section">Section</option>
                            <option value="speaking">Speaking</option>
                            <option value="writing">Writing</option>
                          </select>
                        </div>
                        <div className="homework-field homework-span-8">
                          <label>Search Resource</label>
                          <input
                            value={searchKeyword}
                            onChange={(event) =>
                              setSearchByTask((prev) => ({ ...prev, [taskIndex]: event.target.value }))
                            }
                            placeholder="Search title or id"
                            disabled={!canManage}
                          />
                        </div>
                      </div>
                      <div style={{ maxHeight: "180px", overflow: "auto", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.35rem" }}>
                        {filteredItems.slice(0, 30).map((item) => {
                          const selected = String(task.resource_ref_id || "") === String(item?._id || "");
                          return (
                            <button
                              key={item._id}
                              type="button"
                              className="homework-btn"
                              style={{
                                width: "100%",
                                textAlign: "left",
                                marginBottom: "0.35rem",
                                borderColor: selected ? "#1d4ed8" : undefined,
                              }}
                              onClick={() => updateTask(taskIndex, { resource_ref_id: item._id })}
                              disabled={!canManage}
                            >
                              {item.title || item._id} ({item._id})
                            </button>
                          );
                        })}
                        {!filteredItems.length ? <p className="homework-item-meta">No resources found.</p> : null}
                      </div>
                      {task.resource_ref_id ? (
                        <p className="homework-item-meta">Selected: {getResourceDisplayLabel(task)}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {task.resource_mode === "external_url" ? (
                    <div className="homework-field">
                      <label>Resource URL</label>
                      <input
                        value={task.resource_url || ""}
                        onChange={(event) => updateTask(taskIndex, { resource_url: event.target.value })}
                        placeholder="https://..."
                        disabled={!canManage}
                      />
                    </div>
                  ) : null}

                  {task.resource_mode === "uploaded" ? (
                    <div className="homework-stacked">
                      <div className="homework-task-actions">
                        <input
                          ref={(node) => {
                            if (!node) fileInputRefs.current.delete(taskIndex);
                            else fileInputRefs.current.set(taskIndex, node);
                          }}
                          type="file"
                          style={{ display: "none" }}
                          onChange={(event) => void handleResourceUploadSelected(taskIndex, event)}
                        />
                        <button
                          type="button"
                          className="homework-btn"
                          onClick={() => handleResourceUploadClick(taskIndex)}
                          disabled={!canManage || uploadingTaskIndex === taskIndex}
                        >
                          {uploadingTaskIndex === taskIndex ? "Uploading..." : "Upload Resource"}
                        </button>
                      </div>
                      <div className="homework-field">
                        <label>Uploaded URL</label>
                        <input
                          value={task.resource_url || ""}
                          onChange={(event) => updateTask(taskIndex, { resource_url: event.target.value })}
                          disabled={!canManage}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="homework-grid">
                    <div className="homework-field homework-span-6">
                      <label>Min words</label>
                      <input
                        type="number"
                        value={task.min_words}
                        onChange={(event) => updateTask(taskIndex, { min_words: event.target.value })}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="homework-field homework-span-6">
                      <label>Max words</label>
                      <input
                        type="number"
                        value={task.max_words}
                        onChange={(event) => updateTask(taskIndex, { max_words: event.target.value })}
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
