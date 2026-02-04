import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';

function writingToForm(w) {
  if (!w) return {
    _id: '',
    title: '',
    type: 'academic',
    prompt: '',
    task_type: 'both',
    image_url: '',
    word_limit: 250,
    essay_word_limit: 250,
    time_limit: 60,
    sample_answer: '',
    band_score: '',
  };
  return {
    _id: w._id || '',
    title: w.title || '',
    type: w.type || 'academic',
    prompt: w.prompt || '',
    task_type: w.task_type || 'both',
    image_url: w.image_url || '',
    word_limit: w.word_limit || 250,
    essay_word_limit: w.essay_word_limit || 250,
    time_limit: w.time_limit || 60,
    sample_answer: w.sample_answer || '',
    band_score: w.band_score || '',
  };
}

export default function AddWriting() {
  const { id: editId } = useParams();
  const [writings, setWritings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [existingSearch, setExistingSearch] = useState('');

  const [form, setForm] = useState({
    _id: '',
    title: '',
    type: 'academic',
    prompt: '',
    task_type: 'both',
    image_url: '',
    word_limit: 250,
    essay_word_limit: 250,
    time_limit: 60,
    sample_answer: '',
    band_score: '',
  });

  useEffect(() => {
    setLoading(true);
    if (editId) {
      setLoadError(null);
      Promise.all([
        api.getWritings(),
        api.getWritingById(editId),
      ])
        .then(([wRes, writingRes]) => {
          setWritings(wRes.data || []);
          setForm(writingToForm(writingRes.data));
        })
        .catch((err) => setLoadError(err.message))
        .finally(() => setLoading(false));
    } else {
      api.getWritings()
        .then((wRes) => {
          setWritings(wRes.data || []);
          setForm({ _id: `writing-${Date.now()}`, title: '', type: 'academic', prompt: '', task_type: 'both', image_url: '', word_limit: 250, essay_word_limit: 250, time_limit: 60, sample_answer: '', band_score: '' });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [editId]);

  useEffect(() => {
    if (!editId && success) {
      api.getWritings().then((res) => setWritings(res.data || [])).catch(() => {});
    }
  }, [success, editId]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const matchSearch = (item, query) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item._id || '').toLowerCase().includes(q)
    );
  };

  const filteredWritings = writings.filter((w) => matchSearch(w, existingSearch));

  const handleDeleteWriting = async (writingId) => {
    if (!window.confirm('Delete this writing? This cannot be undone.')) return;
    try {
      await api.deleteWriting(writingId);
      setSuccess('Writing deleted.');
      const res = await api.getWritings();
      setWritings(res.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form._id.trim() || !form.title.trim() || !form.prompt.trim()) {
      setError('ID, title, and prompt are required.');
      return;
    }
    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        type: form.type || 'academic',
        prompt: form.prompt.trim(),
        task_type: form.task_type || 'both',
        image_url: form.image_url?.trim() || '',
        word_limit: Number(form.word_limit) || 250,
        essay_word_limit: Number(form.essay_word_limit) || 250,
        time_limit: Number(form.time_limit) || 60,
        sample_answer: form.sample_answer?.trim() || '',
        band_score: form.band_score ? Number(form.band_score) : undefined,
      };
      if (editId) {
        await api.updateWriting(editId, payload);
        setSuccess('Writing updated.');
      } else {
        await api.createWriting(payload);
        setSuccess('Writing created.');
        setForm({
          _id: `writing-${Date.now()}`,
          title: '',
          type: 'academic',
          prompt: '',
          task_type: 'both',
          image_url: '',
          word_limit: 250,
          essay_word_limit: 250,
          time_limit: 60,
          sample_answer: '',
          band_score: '',
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) return <div className="manage-section"><p className="muted">Loading…</p></div>;
  if (editId && loadError) return <div className="manage-section"><p className="form-error">{loadError}</p><Link to="/manage/writings">Back to writings</Link></div>;

  return (
    <div className="manage-section">
      <h2>{editId ? 'Edit writing' : 'Add writing'}</h2>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <form onSubmit={handleSubmit} className="manage-form">
        <div className="form-row">
          <label>Writing ID *</label>
          <input
            value={form._id}
            onChange={(e) => updateForm('_id', e.target.value)}
            placeholder="e.g. writing-1"
            required
            readOnly={!!editId}
          />
        </div>
        <div className="form-row">
          <label>Title *</label>
          <input
            value={form.title}
            onChange={(e) => updateForm('title', e.target.value)}
            placeholder="e.g. Cambridge 18 - Writing Test 1"
            required
          />
        </div>

        <div className="form-row">
          <label>Writing type *</label>
          <select
            value={form.type || 'academic'}
            onChange={(e) => updateForm('type', e.target.value)}
          >
            <option value="academic">Academic</option>
            <option value="general">General Training</option>
          </select>
        </div>

        <div className="form-row">
          <label>Prompt *</label>
          <textarea
            value={form.prompt}
            onChange={(e) => updateForm('prompt', e.target.value)}
            placeholder="Enter the writing prompt/instructions..."
            rows={4}
            required
          />
        </div>

        <div className="form-row">
          <label>Task type *</label>
          <select
            value={form.task_type || 'both'}
            onChange={(e) => updateForm('task_type', e.target.value)}
          >
            <option value="task1">Task 1 only (Graphs/Charts)</option>
            <option value="task2">Task 2 only (Essay)</option>
            <option value="both">Both Task 1 and Task 2</option>
          </select>
        </div>

        {(form.task_type === 'task1' || form.task_type === 'both') && (
          <div className="form-row">
            <label>Image URL (for Task 1 - Graph/Chart/Diagram)</label>
            <input
              type="url"
              value={form.image_url}
              onChange={(e) => updateForm('image_url', e.target.value)}
              placeholder="https://example.com/graph.png"
            />
            <small className="form-hint">
              Enter the URL of the graph, chart, or diagram image for Task 1
            </small>
            {form.image_url && (
              <div style={{ marginTop: '0.5rem' }}>
                <img 
                  src={form.image_url} 
                  alt="Preview" 
                  style={{ maxWidth: '100%', maxHeight: '300px', border: '1px solid #ddd', borderRadius: '4px' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
          </div>
        )}

        <div className="form-row">
          <label>Word limit (Task 1)</label>
          <input
            type="number"
            value={form.word_limit}
            onChange={(e) => updateForm('word_limit', e.target.value)}
            min={1}
          />
        </div>

        <div className="form-row">
          <label>Word limit (Task 2)</label>
          <input
            type="number"
            value={form.essay_word_limit}
            onChange={(e) => updateForm('essay_word_limit', e.target.value)}
            min={1}
          />
        </div>

        <div className="form-row">
          <label>Time limit (minutes)</label>
          <input
            type="number"
            value={form.time_limit}
            onChange={(e) => updateForm('time_limit', e.target.value)}
            min={1}
          />
        </div>

        <div className="form-row">
          <label>Sample answer (optional, for reference)</label>
          <textarea
            value={form.sample_answer}
            onChange={(e) => updateForm('sample_answer', e.target.value)}
            placeholder="Enter a sample answer..."
            rows={6}
          />
        </div>

        <div className="form-row">
          <label>Band score (optional)</label>
          <input
            type="number"
            value={form.band_score}
            onChange={(e) => updateForm('band_score', e.target.value)}
            min={0}
            max={9}
            step={0.5}
            placeholder="e.g. 7.5"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitLoading}>
            {submitLoading ? (editId ? 'Saving…' : 'Creating…') : (editId ? 'Update writing' : 'Create writing')}
          </button>
          {editId && <Link to="/manage/writings" className="btn btn-ghost" style={{ marginLeft: '0.5rem' }}>Cancel</Link>}
        </div>
      </form>

      <h3>Existing writings</h3>
      {!editId && (
        <>
          <input
            type="search"
            value={existingSearch}
            onChange={(e) => setExistingSearch(e.target.value)}
            placeholder="Search writings by title or ID..."
            className="search-input"
            aria-label="Search existing writings"
          />
          {existingSearch.trim() && (
            <p className="search-hint">
              Showing {filteredWritings.length} of {writings.length} writing{writings.length !== 1 ? 's' : ''}
            </p>
          )}
          <ul className="manage-list">
            {writings.length === 0 ? <li className="muted">No writings yet.</li> : filteredWritings.length === 0 ? (
              <li className="muted">No writings match your search.</li>
            ) : filteredWritings.map((w) => (
              <li key={w._id}>
                <span>{w.title}</span>
                <code>{w._id}</code>
                <Link to={`/manage/writings/${w._id}`} className="edit-link">Edit</Link>
                <button type="button" className="btn btn-ghost btn-sm delete-link" onClick={() => handleDeleteWriting(w._id)}>Delete</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
