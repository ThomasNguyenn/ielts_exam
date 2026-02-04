import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../../api/client';

function testToForm(t) {
  if (!t) return { _id: '', title: '', category: '', type: 'reading', duration: 60, reading_passages: [], listening_sections: [], writing_tasks: [] };
  const toId = (x) => (typeof x === 'object' && x && x._id ? x._id : x);
  return {
    _id: t._id || '',
    title: t.title || '',
    category: t.category || 'Uncategorized',
    type: t.type || 'reading',
    duration: t.duration || (t.type === 'reading' ? 60 : t.type === 'listening' ? 35 : 45),
    reading_passages: (t.reading_passages || []).map(toId),
    listening_sections: (t.listening_sections || []).map(toId),
    writing_tasks: (t.writing_tasks || []).map(toId),
  };
}

function SortableItem({ id, title, subtitle, onRemove, type }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  return (
    <li ref={setNodeRef} style={style} className="sortable-item">
      <div className="drag-handle" {...attributes} {...listeners}>
        <span className="drag-icon">⋮⋮</span>
      </div>
      <div className="sortable-item-content">
        <span className="sortable-item-title">{title}</span>
        <code className="sortable-item-id">{subtitle}</code>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(id)}>
        Remove
      </button>
    </li>
  );
}

export default function AddTest() {
  const { id: editId } = useParams();
  const [passages, setPassages] = useState([]);
  const [sections, setSections] = useState([]);
  const [writings, setWritings] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [existingSearch, setExistingSearch] = useState('');

  const [form, setForm] = useState({
    _id: '',
    title: '',
    category: '',
    type: 'reading',
    duration: 60,
    reading_passages: [],
    listening_sections: [],
    writing_tasks: [],
  });

  const [passageSearch, setPassageSearch] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [writingSearch, setWritingSearch] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setLoading(true);
    if (editId) {
      setLoadError(null);
      Promise.all([
        api.getPassages(),
        api.getSections(),
        api.getWritings(),
        api.getTests(),
        api.getTestById(editId),
      ])
        .then(([pRes, sRes, wRes, tRes, testRes]) => {
          setPassages(pRes.data || []);
          setSections(sRes.data || []);
          setWritings(wRes.data || []);
          setTests(tRes.data || []);
          setForm(testToForm(testRes.data));
        })
        .catch((err) => setLoadError(err.message))
        .finally(() => setLoading(false));
    } else {
      Promise.all([api.getPassages(), api.getSections(), api.getWritings(), api.getTests()])
        .then(([pRes, sRes, wRes, tRes]) => {
          setPassages(pRes.data || []);
          setSections(sRes.data || []);
          setWritings(wRes.data || []);
          setTests(tRes.data || []);
          setForm({ _id: `test-${Date.now()}`, title: '', category: '', type: 'reading', duration: 60, reading_passages: [], listening_sections: [], writing_tasks: [] });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [editId]);

  useEffect(() => {
    if (!editId && success) {
      api.getTests().then((res) => setTests(res.data || [])).catch(() => {});
    }
  }, [success, editId]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const togglePassage = (id) => {
    setForm((prev) => ({
      ...prev,
      reading_passages: prev.reading_passages.includes(id)
        ? prev.reading_passages.filter((x) => x !== id)
        : [...prev.reading_passages, id],
    }));
  };

  const toggleSection = (id) => {
    setForm((prev) => ({
      ...prev,
      listening_sections: prev.listening_sections.includes(id)
        ? prev.listening_sections.filter((x) => x !== id)
        : [...prev.listening_sections, id],
    }));
  };

  const toggleWriting = (id) => {
    setForm((prev) => ({
      ...prev,
      writing_tasks: prev.writing_tasks.includes(id)
        ? prev.writing_tasks.filter((x) => x !== id)
        : [...prev.writing_tasks, id],
    }));
  };

  const removePassage = (id) => {
    setForm((prev) => ({
      ...prev,
      reading_passages: prev.reading_passages.filter((x) => x !== id),
    }));
  };

  const removeSection = (id) => {
    setForm((prev) => ({
      ...prev,
      listening_sections: prev.listening_sections.filter((x) => x !== id),
    }));
  };

  const removeWriting = (id) => {
    setForm((prev) => ({
      ...prev,
      writing_tasks: prev.writing_tasks.filter((x) => x !== id),
    }));
  };

  const handleDragEndPassages = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setForm((prev) => {
        const oldIndex = prev.reading_passages.indexOf(active.id);
        const newIndex = prev.reading_passages.indexOf(over.id);
        return {
          ...prev,
          reading_passages: arrayMove(prev.reading_passages, oldIndex, newIndex),
        };
      });
    }
  };

  const handleDragEndSections = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setForm((prev) => {
        const oldIndex = prev.listening_sections.indexOf(active.id);
        const newIndex = prev.listening_sections.indexOf(over.id);
        return {
          ...prev,
          listening_sections: arrayMove(prev.listening_sections, oldIndex, newIndex),
        };
      });
    }
  };

  const handleDragEndWritings = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setForm((prev) => {
        const oldIndex = prev.writing_tasks.indexOf(active.id);
        const newIndex = prev.writing_tasks.indexOf(over.id);
        return {
          ...prev,
          writing_tasks: arrayMove(prev.writing_tasks, oldIndex, newIndex),
        };
      });
    }
  };

  const matchSearch = (item, query) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item._id || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q)
    );
  };

  const filteredPassages = passages.filter((p) => matchSearch(p, passageSearch));
  const filteredSections = sections.filter((s) => matchSearch(s, sectionSearch));
  const filteredWritings = writings.filter((w) => matchSearch(w, writingSearch));
  const filteredTests = tests.filter((t) => matchSearch(t, existingSearch));

  const getPassageTitle = (id) => passages.find((p) => p._id === id)?.title || id;
  const getPassageSubtitle = (id) => passages.find((p) => p._id === id)?._id || id;
  const getSectionTitle = (id) => sections.find((s) => s._id === id)?.title || id;
  const getSectionSubtitle = (id) => sections.find((s) => s._id === id)?._id || id;
  const getWritingTitle = (id) => writings.find((w) => w._id === id)?.title || id;
  const getWritingSubtitle = (id) => writings.find((w) => w._id === id)?._id || id;

  const handleDeleteTest = async (testId) => {
    if (!window.confirm('Delete this test? This cannot be undone.')) return;
    try {
      await api.deleteTest(testId);
      setSuccess('Test deleted.');
      const res = await api.getTests();
      setTests(res.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRenumber = async () => {
    if (!editId) return;
    if (!window.confirm('Auto-renumber all questions in this test sequentially (1-40)? This will modify the Passages/Sections globally.')) return;
    
    setSubmitLoading(true);
    try {
      const res = await api.renumberTestQuestions(editId);
      setSuccess(res.message || 'Questions renumbered successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form._id.trim() || !form.title.trim() || !form.category.trim()) {
      setError('ID, title, and category are required.');
      return;
    }
    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        category: form.category.trim() || 'Uncategorized',
        type: form.type || 'reading',
        duration: parseInt(form.duration) || 60,
        reading_passages: form.type === 'reading' ? form.reading_passages : [],
        listening_sections: form.type === 'listening' ? form.listening_sections : [],
        writing_tasks: form.type === 'writing' ? form.writing_tasks : [],
      };
      if (editId) {
        await api.updateTest(editId, payload);
        setSuccess('Test updated.');
      } else {
        await api.createTest(payload);
        setSuccess('Test created.');
        setForm({
          _id: `test-${Date.now()}`,
          title: '',
          category: '',
          type: form.type,
          duration: form.type === 'reading' ? 60 : form.type === 'listening' ? 35 : 45,
          reading_passages: [],
          listening_sections: [],
          writing_tasks: [],
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) return <div className="manage-section"><p className="muted">Loading…</p></div>;
  if (editId && loadError) return <div className="manage-section"><p className="form-error">{loadError}</p><Link to="/manage/tests">Back to tests</Link></div>;

  return (
    <div className="manage-section">
      <h2>{editId ? 'Edit test' : 'Add test'}</h2>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <form onSubmit={handleSubmit} className="manage-form">
        <div className="form-row">
          <label>Test ID *</label>
          <input
            value={form._id}
            onChange={(e) => updateForm('_id', e.target.value)}
            placeholder="e.g. test-1"
            required
            readOnly={!!editId}
          />
        </div>
        <div className="form-row">
          <label>Title *</label>
          <input
            value={form.title}
            onChange={(e) => updateForm('title', e.target.value)}
            placeholder="e.g. Cambridge 18 - Test 1"
            required
          />
        </div>
        <div className="form-row">
          <label>Category (book/series) *</label>
          <input
            value={form.category}
            onChange={(e) => updateForm('category', e.target.value)}
            placeholder="e.g. Cambridge 18"
            required
          />
          <small className="form-hint">
            Used to group tests from the same book.
          </small>
        </div>

        <div className="form-row">
          <label>Test type (skill focus) *</label>
          <select
            value={form.type || 'reading'}
            onChange={(e) => {
              const newType = e.target.value;
              updateForm('type', newType);
              const defaultDuration = newType === 'reading' ? 60 : newType === 'listening' ? 35 : 45;
              updateForm('duration', defaultDuration);
            }}
          >
            <option value="reading">Reading only</option>
            <option value="listening">Listening only</option>
            <option value="writing">Writing only</option>
          </select>
        </div>

        <div className="form-row">
          <label>Duration (minutes) *</label>
          <input
            type="number"
            min="1"
            max="180"
            value={form.duration}
            onChange={(e) => updateForm('duration', e.target.value)}
            placeholder="e.g. 60"
            required
          />
          <small className="form-hint">
            Default: Reading = 60 min, Listening = 35 min, Writing = 45 min
          </small>
        </div>

        {form.type === 'reading' && (
        <div className="form-row multi-select-block">
          <label>Reading passages (drag to reorder)</label>
          <input
            type="search"
            value={passageSearch}
            onChange={(e) => setPassageSearch(e.target.value)}
            placeholder="Search passages by title or ID..."
            className="search-input"
            aria-label="Search passages"
          />
          {passageSearch.trim() && (
            <p className="search-hint">
              Showing {filteredPassages.length} of {passages.length} passage{passages.length !== 1 ? 's' : ''}
            </p>
          )}
          <div className="checkbox-group">
            {passages.length === 0 ? (
              <p className="muted">No passages yet. Create passages first.</p>
            ) : filteredPassages.length === 0 ? (
              <p className="muted">No passages match your search.</p>
            ) : (
              filteredPassages.map((p) => (
                <label key={p._id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.reading_passages.includes(p._id)}
                    onChange={() => togglePassage(p._id)}
                  />
                  <span>{p.title} </span>
                  <code>{p._id}</code>
                </label>
              ))
            )}
          </div>
          
          {form.reading_passages.length > 0 && (
            <>
              <p className="selected-hint">Selected passages (drag ⋮⋮ to reorder):</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndPassages}>
                <SortableContext items={form.reading_passages} strategy={verticalListSortingStrategy}>
                  <ul className="sortable-list">
                    {form.reading_passages.map((id) => (
                      <SortableItem key={id} id={id} title={getPassageTitle(id)} subtitle={getPassageSubtitle(id)} onRemove={removePassage} type="passage" />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>
        )}

        {form.type === 'listening' && (
        <div className="form-row multi-select-block">
          <label>Listening sections (drag to reorder)</label>
          <input
            type="search"
            value={sectionSearch}
            onChange={(e) => setSectionSearch(e.target.value)}
            placeholder="Search sections by title or ID..."
            className="search-input"
            aria-label="Search sections"
          />
          {sectionSearch.trim() && (
            <p className="search-hint">
              Showing {filteredSections.length} of {sections.length} section{sections.length !== 1 ? 's' : ''}
            </p>
          )}
          <div className="checkbox-group">
            {sections.length === 0 ? (
              <p className="muted">No sections yet. Create sections first.</p>
            ) : filteredSections.length === 0 ? (
              <p className="muted">No sections match your search.</p>
            ) : (
              filteredSections.map((s) => (
                <label key={s._id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.listening_sections.includes(s._id)}
                    onChange={() => toggleSection(s._id)}
                  />
                  <span>{s.title}</span>
                  <code>{s._id}</code>
                </label>
              ))
            )}
          </div>
          
          {form.listening_sections.length > 0 && (
            <>
              <p className="selected-hint">Selected sections (drag ⋮⋮ to reorder):</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndSections}>
                <SortableContext items={form.listening_sections} strategy={verticalListSortingStrategy}>
                  <ul className="sortable-list">
                    {form.listening_sections.map((id) => (
                      <SortableItem key={id} id={id} title={getSectionTitle(id)} subtitle={getSectionSubtitle(id)} onRemove={removeSection} type="section" />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>
        )}

        {form.type === 'writing' && (
        <div className="form-row multi-select-block">
          <label>Writing tasks (drag to reorder)</label>
          <input
            type="search"
            value={writingSearch}
            onChange={(e) => setWritingSearch(e.target.value)}
            placeholder="Search writing tasks by title or ID..."
            className="search-input"
            aria-label="Search writing tasks"
          />
          {writingSearch.trim() && (
            <p className="search-hint">
              Showing {filteredWritings.length} of {writings.length} writing task{writings.length !== 1 ? 's' : ''}
            </p>
          )}
          <div className="checkbox-group">
            {writings.length === 0 ? (
              <p className="muted">No writing tasks yet. Create writing tasks first.</p>
            ) : filteredWritings.length === 0 ? (
              <p className="muted">No writing tasks match your search.</p>
            ) : (
              filteredWritings.map((w) => (
                <label key={w._id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.writing_tasks.includes(w._id)}
                    onChange={() => toggleWriting(w._id)}
                  />
                  <span>{w.title}</span>
                  <code>{w._id}</code>
                </label>
              ))
            )}
          </div>
          
          {form.writing_tasks.length > 0 && (
            <>
              <p className="selected-hint">Selected writing tasks (drag ⋮⋮ to reorder):</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndWritings}>
                <SortableContext items={form.writing_tasks} strategy={verticalListSortingStrategy}>
                  <ul className="sortable-list">
                    {form.writing_tasks.map((id) => (
                      <SortableItem key={id} id={id} title={getWritingTitle(id)} subtitle={getWritingSubtitle(id)} onRemove={removeWriting} type="writing" />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitLoading}>
            {submitLoading ? (editId ? 'Saving…' : 'Creating…') : (editId ? 'Update test' : 'Create test')}
          </button>
          
          {editId && (
            <button
              type="button" 
              className="btn btn-secondary" 
              onClick={handleRenumber} 
              disabled={submitLoading}
              style={{ marginLeft: '0.5rem', background: '#eab308', borderColor: '#ca8a04', color: 'white' }}
            >
              Auto Renumber Questions
            </button>
          )}

          {editId && <Link to="/manage/tests" className="btn btn-ghost" style={{ marginLeft: '0.5rem' }}>Cancel</Link>}
        </div>
      </form>

      <h3>Existing tests</h3>
      {!editId && (
        <>
          <input
            type="search"
            value={existingSearch}
            onChange={(e) => setExistingSearch(e.target.value)}
            placeholder="Search tests by title or ID..."
            className="search-input"
            aria-label="Search existing tests"
          />
          {existingSearch.trim() && (
            <p className="search-hint">
              Showing {filteredTests.length} of {tests.length} test{tests.length !== 1 ? 's' : ''}
            </p>
          )}
          <ul className="manage-list">
            {tests.length === 0 ? <li className="muted">No tests yet.</li> : filteredTests.length === 0 ? (
              <li className="muted">No tests match your search.</li>
            ) : filteredTests.map((t) => (
              <li key={t._id}>
                <span>{t.title}</span>
                <code>{t._id}</code>
                <span className="muted">{t.category || 'Uncategorized'}</span>
                <Link to={`/manage/tests/${t._id}`} className="edit-link">Edit</Link>
                <button type="button" className="btn btn-ghost btn-sm delete-link" onClick={() => handleDeleteTest(t._id)}>Delete</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
