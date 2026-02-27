import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import './Manage.css';

function testToForm(test) {
  if (!test) {
    return {
      _id: '',
      title: '',
      category: '',
      type: 'reading',
      duration: 60,
      full_audio: '',
      is_active: true,
      is_real_test: false,
      reading_passages: [],
      listening_sections: [],
      writing_tasks: [],
      createdAt: null,
    };
  }

  const toId = (value) => (typeof value === 'object' && value?._id ? value._id : value);

  return {
    _id: test._id || '',
    title: test.title || '',
    category: test.category || '',
    type: test.type || 'reading',
    duration: Number(test.duration || (test.type === 'listening' ? 35 : test.type === 'writing' ? 60 : 60)),
    full_audio: test.full_audio || '',
    is_active: test.is_active ?? true,
    is_real_test: test.is_real_test ?? false,
    reading_passages: (test.reading_passages || []).map(toId),
    listening_sections: (test.listening_sections || []).map(toId),
    writing_tasks: (test.writing_tasks || []).map(toId),
    createdAt: test.created_at || test.createdAt || null,
  };
}

function SortableLinkedItem({ item, index, onRemove, accentColor = '#6366F1' }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        border: '1px solid #E2E8F0',
        borderLeft: `4px solid ${accentColor}`,
        background: '#fff',
        borderRadius: '0.75rem',
        padding: '0.75rem',
      }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        style={{ border: 0, background: 'transparent', cursor: 'grab', color: '#94A3B8', fontWeight: 700 }}
        title="Drag to reorder"
      >
        ⋮⋮
      </button>

      <span style={{ minWidth: 26, display: 'inline-flex', justifyContent: 'center', fontWeight: 700, color: accentColor }}>
        {index + 1}
      </span>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.title}</div>
        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{item.id}</div>
      </div>

      <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#EF4444' }} onClick={() => onRemove(item.id)}>
        Remove
      </button>
    </div>
  );
}

export default function AddTest({ editIdOverride = null, embedded = false, onSaved = null, onCancel = null }) {
  const { id: routeEditId } = useParams();
  const normalizedRouteEditId = routeEditId === 'new' ? null : routeEditId;
  const editId = editIdOverride ?? normalizedRouteEditId;
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [form, setForm] = useState(testToForm(null));
  const [passages, setPassages] = useState([]);
  const [sections, setSections] = useState([]);
  const [writings, setWritings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [passagesRes, sectionsRes, writingsRes, maybeTestRes] = await Promise.all([
          api.getPassages(),
          api.getSections(),
          api.getWritings(),
          editId ? api.getTestById(editId) : Promise.resolve(null),
        ]);

        setPassages(passagesRes.data || []);
        setSections(sectionsRes.data || []);
        setWritings(writingsRes.data || []);

        if (editId && maybeTestRes?.data) {
          setForm(testToForm(maybeTestRes.data));
        } else {
          setForm({
            ...testToForm(null),
            _id: `test-${Date.now()}`,
          });
        }
      } catch (loadErr) {
        setLoadError(loadErr.message);
        showNotification(`Error loading test editor: ${loadErr.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [editId, showNotification]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const getMaxItems = () => {
    if (form.type === 'reading') return 3;
    if (form.type === 'listening') return 4;
    return 2;
  };

  const getCurrentItems = () => {
    if (form.type === 'reading') return passages;
    if (form.type === 'listening') return sections;
    return writings;
  };

  const getCurrentLinkedIds = () => {
    if (form.type === 'reading') return form.reading_passages;
    if (form.type === 'listening') return form.listening_sections;
    return form.writing_tasks;
  };

  const setCurrentLinkedIds = (ids) => {
    if (form.type === 'reading') updateForm('reading_passages', ids);
    else if (form.type === 'listening') updateForm('listening_sections', ids);
    else updateForm('writing_tasks', ids);
  };

  const linkedItems = useMemo(() => {
    const ids = getCurrentLinkedIds();
    const items = getCurrentItems();
    return ids.map((id) => items.find((item) => item._id === id)).filter(Boolean);
  }, [form.reading_passages, form.listening_sections, form.writing_tasks, form.type, passages, sections, writings]);

  const filteredSearchItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const linkedSet = new Set(getCurrentLinkedIds());
    const base = getCurrentItems().filter((item) => !linkedSet.has(item._id));

    if (!q) return base;
    return base.filter((item) =>
      String(item.title || '').toLowerCase().includes(q) ||
      String(item._id || '').toLowerCase().includes(q)
    );
  }, [searchQuery, form.type, passages, sections, writings, form.reading_passages, form.listening_sections, form.writing_tasks]);

  const hasValidationError = linkedItems.length === 0 || linkedItems.length > getMaxItems();

  const accentColor = form.type === 'reading' ? '#6366F1' : form.type === 'listening' ? '#0EA5E9' : '#10B981';

  const handleAddLinkedItem = (id) => {
    const ids = getCurrentLinkedIds();
    if (ids.includes(id)) return;
    if (ids.length >= getMaxItems()) return;
    setCurrentLinkedIds([...ids, id]);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleRemoveLinkedItem = (id) => {
    setCurrentLinkedIds(getCurrentLinkedIds().filter((itemId) => itemId !== id));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    const ids = getCurrentLinkedIds();
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = [...ids];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    setCurrentLinkedIds(next);
  };

  const saveTest = async ({ asDraft = false } = {}) => {
    setError(null);

    if (!form._id.trim() || !form.title.trim() || !form.category.trim()) {
      showNotification('ID, title, and category are required.', 'error');
      return;
    }

    if (hasValidationError) {
      showNotification('Please add valid linked items before saving.', 'error');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        category: form.category.trim(),
        type: form.type,
        duration: Number(form.duration) || 60,
        full_audio: form.type === 'listening' ? (form.full_audio?.trim() || null) : null,
        is_active: asDraft ? false : form.is_active,
        is_real_test: form.is_real_test,
        reading_passages: form.type === 'reading' ? form.reading_passages : [],
        listening_sections: form.type === 'listening' ? form.listening_sections : [],
        writing_tasks: form.type === 'writing' ? form.writing_tasks : [],
      };

      let savedTestId = editId || payload._id;
      const actionLabel = asDraft ? 'draft saved' : (editId ? 'updated' : 'created');

      if (editId) {
        const updateRes = await api.updateTest(editId, payload);
        savedTestId = updateRes?.data?._id || savedTestId;
      } else {
        const createRes = await api.createTest(payload);
        savedTestId = createRes?.data?._id || savedTestId;
        if (!editIdOverride) {
          navigate(`/manage/tests/${savedTestId}`);
        }
      }

      let renumberError = null;
      const shouldRenumberQuestions = form.type === 'reading' || form.type === 'listening';

      if (shouldRenumberQuestions && savedTestId) {
        try {
          await api.renumberTestQuestions(savedTestId);
        } catch (renumberErr) {
          renumberError = renumberErr;
        }
      }

      if (renumberError) {
        showNotification(`Test ${actionLabel}, but auto-reorder question number failed: ${renumberError.message}`, 'warning');
      } else if (shouldRenumberQuestions) {
        showNotification(`Test ${actionLabel}. Question numbers were auto-reordered.`, 'success');
      } else {
        showNotification(`Test ${actionLabel}.`, 'success');
      }

      if (asDraft) {
        updateForm('is_active', false);
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
    event.preventDefault();
    await saveTest({ asDraft: false });
  };

  const handleSaveDraft = async () => {
    await saveTest({ asDraft: true });
  };

  if (loading) return <div className="manage-container"><p className="muted">Loading...</p></div>;
  if (loadError) return <div className="manage-container"><p className="form-error">{loadError}</p></div>;

  const metadataDate = form.createdAt
    ? new Date(form.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="manage-container">
      <div className="manage-editor-topbar">
        <div className="manage-editor-title">
          <button
            type="button"
            className="manage-editor-close"
            onClick={() => {
              if (typeof onCancel === 'function') onCancel();
              else navigate('/manage/tests');
            }}
            title="Close editor"
          >
            <X size={18} />
          </button>
          <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{editId ? 'Edit Full Test' : 'Create Full Test'}</h1>
          <p className="muted" style={{ marginTop: '0.5rem' }}>Compose a full test by linking passages, sections, or writing tasks.</p>
          </div>
        </div>

        <div className="manage-header-actions">
          <label className="status-toggle">
            {form.is_active ? 'Active' : 'Inactive'}
            <div className="switch">
              <input type="checkbox" checked={form.is_active} onChange={(event) => updateForm('is_active', event.target.checked)} />
              <span className="slider"></span>
            </div>
          </label>

          <button type="button" className="btn-ghost" onClick={handleSaveDraft}>Save Draft</button>

          <button type="button" className="btn-manage-add" onClick={handleSubmit} disabled={submitLoading}>
            {submitLoading ? 'Saving...' : 'Save Test'}
          </button>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="manage-layout-columns">
        <div className="manage-main">
          <div className="manage-card card-accent-purple">
            <h3>Basic Information</h3>

            <div className="manage-input-group">
              <label className="manage-input-label">Test ID</label>
              <input
                className="manage-input-field"
                value={form._id}
                onChange={(event) => updateForm('_id', event.target.value)}
                readOnly={!!editId}
                placeholder="e.g., TEST_FULL_001"
              />
            </div>

            <div className="manage-input-group">
              <label className="manage-input-label">Title</label>
              <input
                className="manage-input-field"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                placeholder="e.g., Full Practice Test #12"
              />
            </div>

            <div className="manage-input-group">
              <label className="manage-input-label">Category</label>
              <input
                className="manage-input-field"
                value={form.category}
                onChange={(event) => updateForm('category', event.target.value)}
                placeholder="e.g., Cambridge 18"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Test Type</label>
                <select
                  className="manage-input-field"
                  value={form.type}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    updateForm('type', nextType);
                    updateForm('duration', nextType === 'listening' ? 35 : nextType === 'writing' ? 60 : 60);
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                >
                  <option value="reading">Reading Test</option>
                  <option value="listening">Listening Test</option>
                  <option value="writing">Writing Test</option>
                </select>
              </div>

              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Duration (minutes)</label>
                <input
                  className="manage-input-field"
                  type="number"
                  value={form.duration}
                  onChange={(event) => updateForm('duration', event.target.value)}
                />
              </div>
            </div>

            {form.type === 'listening' && (
              <div className="manage-input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                <label className="manage-input-label">Full Audio URL (Optional)</label>
                <input
                  className="manage-input-field"
                  value={form.full_audio}
                  onChange={(event) => updateForm('full_audio', event.target.value)}
                  placeholder="https://example.com/full-listening.mp3"
                />
              </div>
            )}
          </div>

          <div className="manage-card">
            <h3>Linked Content</h3>

            {hasValidationError && (
              <div className="form-error" style={{ marginBottom: '0.75rem' }}>
                {linkedItems.length === 0
                  ? 'Add at least one linked item to build this test.'
                  : `Too many linked items (${linkedItems.length}/${getMaxItems()}).`}
              </div>
            )}

            <div className="manage-input-group" style={{ marginBottom: '0.75rem', position: 'relative' }}>
              <label className="manage-input-label">Search and Add</label>
              <input
                className="manage-input-field"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setShowSearchResults(event.target.value.trim().length > 0);
                }}
                onFocus={() => setShowSearchResults(searchQuery.trim().length > 0)}
                placeholder={`Search ${form.type} items...`}
                disabled={linkedItems.length >= getMaxItems()}
              />

              {showSearchResults && (
                <div
                  style={{
                    position: 'absolute',
                    zIndex: 20,
                    left: 0,
                    right: 0,
                    top: '100%',
                    marginTop: '0.35rem',
                    background: '#fff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '0.75rem',
                    boxShadow: '0 8px 18px rgba(15,23,42,0.1)',
                    maxHeight: '260px',
                    overflowY: 'auto',
                  }}
                >
                  {filteredSearchItems.length === 0 ? (
                    <div style={{ padding: '0.75rem', color: '#94A3B8', fontSize: '0.85rem' }}>No available items found.</div>
                  ) : (
                    filteredSearchItems.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => handleAddLinkedItem(item._id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          border: 0,
                          borderBottom: '1px solid #F1F5F9',
                          background: '#fff',
                          padding: '0.65rem 0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.title || item._id}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{item._id}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {linkedItems.length === 0 ? (
                <div style={{ padding: '1.5rem', border: '1px dashed #CBD5E1', borderRadius: '0.75rem', textAlign: 'center', color: '#64748B' }}>
                  No linked items yet.
                </div>
              ) : (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={linkedItems.map((item) => item._id)} strategy={verticalListSortingStrategy}>
                    {linkedItems.map((item, index) => (
                      <SortableLinkedItem
                        key={item._id}
                        item={{ id: item._id, title: item.title || item._id }}
                        index={index}
                        accentColor={accentColor}
                        onRemove={handleRemoveLinkedItem}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
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
                <span className={`meta-badge ${form.is_active ? 'badge-active' : 'badge-draft'}`}>{form.is_active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="meta-item" style={{ background: '#EEF2FF', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Linked Items</span>
                <span className="meta-value" style={{ color: '#6366F1' }}>{linkedItems.length} / {getMaxItems()}</span>
              </div>
              <div className="meta-item" style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Type</span>
                <span className="meta-value" style={{ textTransform: 'capitalize' }}>{form.type}</span>
              </div>
            </div>
          </div>

          <div className="manage-card">
            <h3>Settings</h3>
            <div className="metadata-list">
              <div className="meta-item">
                <span className="meta-label">Real IELTS Test</span>
                <input type="checkbox" checked={form.is_real_test} onChange={(event) => updateForm('is_real_test', event.target.checked)} />
              </div>
              <div className="meta-item">
                <span className="meta-label">Visible to Students</span>
                <input type="checkbox" checked={form.is_active} onChange={(event) => updateForm('is_active', event.target.checked)} />
              </div>
            </div>
          </div>

          <div className="manage-card tips-card">
            <h3>Validation Rules</h3>
            <ul className="tips-list">
              <li>{linkedItems.length > 0 ? '✓' : '○'} At least 1 linked item required</li>
              <li>{linkedItems.length <= getMaxItems() ? '✓' : '✗'} Max {getMaxItems()} items for {form.type}</li>
              <li>Reorder linked items by drag and drop.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
