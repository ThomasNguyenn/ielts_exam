import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';

function testToForm(t) {
  if (!t) return { _id: '', title: '', type: 'reading', reading_passages: [], listening_sections: [] };
  const toId = (x) => (typeof x === 'object' && x && x._id ? x._id : x);
  return {
    _id: t._id || '',
    title: t.title || '',
    type: t.type || 'reading',
    reading_passages: (t.reading_passages || []).map(toId),
    listening_sections: (t.listening_sections || []).map(toId),
  };
}

export default function AddTest() {
  const { id: editId } = useParams();
  const [passages, setPassages] = useState([]);
  const [sections, setSections] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [form, setForm] = useState({
    _id: '',
    title: '',
    type: 'reading',
    reading_passages: [],
    listening_sections: [],
  });

  const [passageSearch, setPassageSearch] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    if (editId) {
      setLoadError(null);
      Promise.all([
        api.getPassages(),
        api.getSections(),
        api.getTests(),
        api.getTestById(editId),
      ])
        .then(([pRes, sRes, tRes, testRes]) => {
          setPassages(pRes.data || []);
          setSections(sRes.data || []);
          setTests(tRes.data || []);
          setForm(testToForm(testRes.data));
        })
        .catch((err) => setLoadError(err.message))
        .finally(() => setLoading(false));
    } else {
      Promise.all([api.getPassages(), api.getSections(), api.getTests()])
        .then(([pRes, sRes, tRes]) => {
          setPassages(pRes.data || []);
          setSections(sRes.data || []);
          setTests(tRes.data || []);
          setForm({ _id: `test-${Date.now()}`, title: '', type: 'reading', reading_passages: [], listening_sections: [] });
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

  const matchSearch = (item, query) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item._id || '').toLowerCase().includes(q)
    );
  };

  const filteredPassages = passages.filter((p) => matchSearch(p, passageSearch));
  const filteredSections = sections.filter((s) => matchSearch(s, sectionSearch));

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form._id.trim() || !form.title.trim()) {
      setError('ID and title are required.');
      return;
    }
    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        type: form.type || 'reading',
        reading_passages: form.type === 'reading' ? form.reading_passages : [],
        listening_sections: form.type === 'listening' ? form.listening_sections : [],
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
          reading_passages: [],
          listening_sections: [],
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
          <label>Test type (skill focus) *</label>
          <select
            value={form.type || 'reading'}
            onChange={(e) => updateForm('type', e.target.value)}
          >
            <option value="reading">Reading only</option>
            <option value="listening">Listening only</option>
          </select>
        </div>

        {form.type === 'reading' && (
        <div className="form-row multi-select-block">
          <label>Reading passages (order = display order)</label>
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
            <p className="selected-hint">{form.reading_passages.length} passage{form.reading_passages.length !== 1 ? 's' : ''} selected</p>
          )}
        </div>
        )}

        {form.type === 'listening' && (
        <div className="form-row multi-select-block">
          <label>Listening sections (order = display order)</label>
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
            <p className="selected-hint">{form.listening_sections.length} section{form.listening_sections.length !== 1 ? 's' : ''} selected</p>
          )}
        </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitLoading}>
            {submitLoading ? (editId ? 'Saving…' : 'Creating…') : (editId ? 'Update test' : 'Create test')}
          </button>
          {editId && <Link to="/manage/tests" className="btn btn-ghost" style={{ marginLeft: '0.5rem' }}>Cancel</Link>}
        </div>
      </form>

      <h3>Existing tests</h3>
      {!editId && (
        <ul className="manage-list">
          {tests.length === 0 ? <li className="muted">No tests yet.</li> : tests.map((t) => (
            <li key={t._id}>
              <span>{t.title}</span>
              <code>{t._id}</code>
              <Link to={`/manage/tests/${t._id}`} className="edit-link">Edit</Link>
              <button type="button" className="btn btn-ghost btn-sm delete-link" onClick={() => handleDeleteTest(t._id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
