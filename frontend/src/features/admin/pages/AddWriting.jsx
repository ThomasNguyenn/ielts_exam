import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import { getWritingTaskTypeOptions } from '@/shared/constants/writingTaskTypes';
import './Manage.css';

function writingToForm(writing) {
  if (!writing) {
    return {
      _id: '',
      title: '',
      type: 'academic',
      task_type: 'task1',
      writing_task_type: '',
      prompt: '',
      image_url: '',
      word_limit: 150,
      essay_word_limit: 250,
      time_limit: 20,
      sample_answer: '',
      band_score: '7.0',
      isActive: true,
      is_real_test: false,
      isSinglePart: false,
      createdAt: null,
    };
  }

  return {
    _id: writing._id || '',
    title: writing.title || '',
    type: writing.type || 'academic',
    task_type: writing.task_type || 'task1',
    writing_task_type: writing.writing_task_type || '',
    prompt: writing.prompt || '',
    image_url: writing.image_url || '',
    word_limit: writing.word_limit ?? 150,
    essay_word_limit: writing.essay_word_limit ?? 250,
    time_limit: writing.time_limit ?? 20,
    sample_answer: writing.sample_answer || '',
    band_score: String(writing.band_score ?? '7.0'),
    isActive: writing.is_active ?? true,
    is_real_test: writing.is_real_test ?? false,
    isSinglePart: writing.isSinglePart ?? false,
    createdAt: writing.created_at || writing.createdAt || null,
  };
}

export default function AddWriting({ editIdOverride = null, embedded = false, onSaved = null, onCancel = null }) {
  const { id: routeEditId } = useParams();
  const normalizedRouteEditId = routeEditId === 'new' ? null : routeEditId;
  const editId = editIdOverride ?? normalizedRouteEditId;
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const showNotificationRef = useRef(showNotification);

  const [form, setForm] = useState(writingToForm(null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState(null);

  const isTask1 = form.task_type === 'task1';

  useEffect(() => {
    showNotificationRef.current = showNotification;
  }, [showNotification]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (editId) {
          const response = await api.getWritingById(editId);
          setForm(writingToForm(response.data));
        } else {
          setForm({
            ...writingToForm(null),
            _id: `writing-${Date.now()}`,
          });
        }
      } catch (loadErr) {
        setLoadError(loadErr.message);
        showNotificationRef.current?.(`Error loading writing task: ${loadErr.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [editId]);

  const metadataDate = useMemo(() => {
    if (form.createdAt) {
      return new Date(form.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [form.createdAt]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.uploadImage(formData);
      if (response?.success && response?.data?.url) {
        updateForm('image_url', response.data.url);
        showNotification('Image uploaded successfully.', 'success');
      }
    } catch (uploadErr) {
      showNotification(uploadErr.message || 'Image upload failed', 'error');
    } finally {
      setUploadLoading(false);
      event.target.value = '';
    }
  };

  const saveWriting = async ({ asDraft = false } = {}) => {
    setError(null);

    if (!form._id.trim() || !form.title.trim() || !form.prompt.trim()) {
      showNotification('ID, title, and prompt are required.', 'error');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        type: form.type,
        task_type: form.task_type,
        writing_task_type: form.writing_task_type?.trim() || null,
        prompt: form.prompt.trim(),
        image_url: form.image_url?.trim() || '',
        word_limit: Number(form.word_limit) || 150,
        essay_word_limit: Number(form.essay_word_limit) || 250,
        time_limit: Number(form.time_limit) || (form.task_type === 'task1' ? 20 : 40),
        sample_answer: form.sample_answer?.trim() || '',
        band_score: Number(form.band_score) || undefined,
        is_active: asDraft ? false : form.isActive,
        is_real_test: form.is_real_test,
        isSinglePart: Boolean(form.isSinglePart),
      };

      if (editId) {
        await api.updateWriting(editId, payload);
        showNotification(asDraft ? 'Draft saved.' : 'Writing task updated.', 'success');
      } else {
        await api.createWriting(payload);
        showNotification(asDraft ? 'Draft saved.' : 'Writing task created.', 'success');
        if (!editIdOverride) {
          navigate(`/manage/writings/${form._id}`);
        }
      }

      if (asDraft) {
        setForm((prev) => ({ ...prev, isActive: false }));
      }
      if (typeof onSaved === 'function') onSaved();
    } catch (submitErr) {
      setError(submitErr.message);
      showNotification(submitErr.message, 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    await saveWriting({ asDraft: false });
  };

  const handleSaveDraft = async () => {
    await saveWriting({ asDraft: true });
  };

  if (loading) return <div className="manage-container"><p className="muted">Loading...</p></div>;
  if (loadError) return <div className="manage-container"><p className="form-error">{loadError}</p></div>;

  return (
    <div className="manage-container">
      <div className="manage-editor-topbar">
        <div className="manage-editor-title">
          <button
            type="button"
            className="manage-editor-close"
            onClick={() => {
              if (typeof onCancel === 'function') onCancel();
              else navigate('/manage/writings');
            }}
            title="Close editor"
          >
            <X size={18} />
          </button>
          <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{editId ? 'Edit Writing Task' : 'Create Writing Task'}</h1>
          <p className="muted" style={{ marginTop: '0.5rem' }}>IELTS Writing Task 1 or Task 2 editor.</p>
          </div>
        </div>

        <div className="manage-header-actions">
          <label className="status-toggle">
            {form.isActive ? 'Active' : 'Inactive'}
            <div className="switch">
              <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm('isActive', event.target.checked)} />
              <span className="slider"></span>
            </div>
          </label>

          <button type="button" className="btn-ghost" onClick={handleSaveDraft}>Save Draft</button>

          <button type="button" className="btn-manage-add" onClick={handleSubmit} disabled={submitLoading}>
            {submitLoading ? 'Saving...' : 'Save Task'}
          </button>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="manage-layout-columns">
        <div className="manage-main">
          <div className="manage-card card-accent-green">
            <h3>Basic Information</h3>

            <div className="manage-input-group">
              <label className="manage-input-label">Writing Task ID</label>
              <input
                className="manage-input-field"
                value={form._id}
                onChange={(event) => updateForm('_id', event.target.value)}
                readOnly={!!editId}
                placeholder="e.g., WRITE_AC_T1_001"
              />
            </div>

            <div className="manage-input-group">
              <label className="manage-input-label">Title</label>
              <input
                className="manage-input-field"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                placeholder="Enter task title"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Type</label>
                <select className="manage-input-field" value={form.type} onChange={(event) => updateForm('type', event.target.value)}>
                  <option value="academic">Academic</option>
                  <option value="general">General Training</option>
                </select>
              </div>

              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Task Type</label>
                <select
                  className="manage-input-field"
                  value={form.task_type}
                  onChange={(event) => {
                    const nextTaskType = event.target.value;
                    setForm((prev) => {
                      const options = getWritingTaskTypeOptions(nextTaskType);
                      const currentValid = options.some((o) => o.value === prev.writing_task_type);
                      return {
                        ...prev,
                        task_type: nextTaskType,
                        writing_task_type: currentValid ? prev.writing_task_type : '',
                        word_limit: nextTaskType === 'task1' ? 150 : 250,
                        time_limit: nextTaskType === 'task1' ? 20 : 40,
                      };
                    });
                  }}
                >
                  <option value="task1">Task 1</option>
                  <option value="task2">Task 2</option>
                </select>
              </div>

              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Task Variant</label>
                <select
                  className="manage-input-field"
                  value={form.writing_task_type}
                  onChange={(event) => updateForm('writing_task_type', event.target.value)}
                >
                  <option value="">— Select —</option>
                  {getWritingTaskTypeOptions(form.task_type).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="manage-card">
            <h3>Task Prompt</h3>

            <div className="manage-input-group">
              <label className="manage-input-label">Prompt Text</label>
              <textarea
                className="manage-input-field"
                value={form.prompt}
                onChange={(event) => updateForm('prompt', event.target.value)}
                rows={7}
                placeholder={isTask1
                  ? 'The chart below shows ... Summarise the information by selecting and reporting the main features.'
                  : 'Some people believe that ... To what extent do you agree or disagree?'}
              />
            </div>

            {isTask1 && (
              <div className="manage-input-group">
                <label className="manage-input-label">Visual (Task 1)</label>
                <input
                  className="manage-input-field"
                  value={form.image_url}
                  onChange={(event) => updateForm('image_url', event.target.value)}
                  placeholder="https://example.com/chart.png"
                />

                <div style={{ marginTop: '0.65rem' }}>
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadLoading} />
                  {uploadLoading && <span className="muted" style={{ marginLeft: '0.65rem' }}>Uploading...</span>}
                </div>

                {form.image_url && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <img
                      src={form.image_url}
                      alt="Task visual"
                      style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '0.65rem', border: '1px solid #E2E8F0' }}
                    />
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Word Limit</label>
                <input
                  className="manage-input-field"
                  type="number"
                  value={form.word_limit}
                  onChange={(event) => updateForm('word_limit', event.target.value)}
                />
              </div>

              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Essay Word Limit</label>
                <input
                  className="manage-input-field"
                  type="number"
                  value={form.essay_word_limit}
                  onChange={(event) => updateForm('essay_word_limit', event.target.value)}
                />
              </div>

              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Time Limit (minutes)</label>
                <input
                  className="manage-input-field"
                  type="number"
                  value={form.time_limit}
                  onChange={(event) => updateForm('time_limit', event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="manage-card">
            <h3>Sample Answer</h3>

            <div className="manage-input-group">
              <label className="manage-input-label">Sample Response</label>
              <textarea
                className="manage-input-field"
                value={form.sample_answer}
                onChange={(event) => updateForm('sample_answer', event.target.value)}
                rows={10}
                placeholder="Enter sample answer (optional)..."
              />
            </div>

            <div className="manage-input-group" style={{ marginBottom: 0 }}>
              <label className="manage-input-label">Band Score</label>
              <input
                className="manage-input-field"
                type="number"
                min={0}
                max={9}
                step={0.5}
                value={form.band_score}
                onChange={(event) => updateForm('band_score', event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="manage-sidebar-column">
          <div className="manage-card">
            <h3>Metadata</h3>
            <div className="metadata-list">
              <div className="meta-item">
                <span className="meta-label">Created</span>
                <span className="meta-value">{metadataDate}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Status</span>
                <span className={`meta-badge ${form.isActive ? 'badge-active' : 'badge-draft'}`}>
                  {form.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Standalone Part</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.isSinglePart}
                    onChange={(event) => updateForm('isSinglePart', event.target.checked)}
                  />
                  <span className="meta-value">Show in Parts view</span>
                </label>
              </div>
              <div className="meta-item" style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Mode</span>
                <span className="meta-value">{form.type === 'academic' ? 'Academic' : 'General'}</span>
              </div>
              <div className="meta-item" style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Task</span>
                <span className="meta-value">{form.task_type === 'task1' ? 'Task 1' : 'Task 2'}</span>
              </div>
            </div>
          </div>

          <div className="manage-card">
            <h3>Settings</h3>
            <div className="metadata-list">
              <div className="meta-item">
                <span className="meta-label">Real IELTS Test</span>
                <input
                  type="checkbox"
                  checked={form.is_real_test}
                  onChange={(event) => updateForm('is_real_test', event.target.checked)}
                />
              </div>
              <div className="meta-item">
                <span className="meta-label">Visible to Students</span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateForm('isActive', event.target.checked)}
                />
              </div>
            </div>
          </div>

          <div className="manage-card tips-card" style={{ background: 'linear-gradient(135deg, #ECFDF5 0%, #DCFCE7 100%)' }}>
            <h3 style={{ color: '#047857' }}>Tips</h3>
            <ul className="tips-list">
              <li>Task 1 prompts should stay objective and data-driven.</li>
              <li>Task 2 prompts should clearly ask for a position or discussion.</li>
              <li>Keep limits realistic for IELTS timing.</li>
              <li>Use sample answers for rubric calibration, not memorization.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
