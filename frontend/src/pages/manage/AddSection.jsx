import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';

const QUESTION_GROUP_TYPES = [
  { value: 'mult_choice', label: 'Multiple choice' },
  { value: 'true_false_notgiven', label: 'True / False / Not given' },
  { value: 'gap_fill', label: 'Gap fill' },
  { value: 'matching_features', label: 'Matching features' },
];

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function emptyQuestion(qNumber = 1) {
  return {
    q_number: qNumber,
    text: '',
    option: OPTION_LABELS.map((label) => ({ label, text: '' })),
    correct_answers: [''],
    explanation: '',
  };
}

function emptyHeading() {
  return { id: '', text: '' };
}

function emptyQuestionGroup() {
  return {
    type: 'mult_choice',
    instructions: '',
    headings: [],
    questions: [emptyQuestion(1)],
  };
}

function sectionToForm(s) {
  if (!s) return { _id: '', title: '', content: '', audio_url: '', source: '', question_groups: [emptyQuestionGroup()] };
  const groups = s.question_groups && s.question_groups.length
    ? s.question_groups.map((g) => ({
        type: g.type || 'mult_choice',
        instructions: g.instructions || '',
        headings: (g.headings || []).map((h) => ({ id: h.id || '', text: h.text || '' })),
        questions: (g.questions || []).map((q, i) => ({
          q_number: q.q_number ?? i + 1,
          text: q.text || '',
          option: OPTION_LABELS.map((label) => {
            const o = (q.option || []).find((x) => x.label === label);
            return { label, text: o?.text ?? '' };
          }),
          correct_answers: (q.correct_answers && q.correct_answers.length) ? [...q.correct_answers] : [''],
          explanation: q.explanation || '',
        })),
      }))
    : [emptyQuestionGroup()];
  return {
    _id: s._id || '',
    title: s.title || '',
    content: s.content || '',
    audio_url: s.audio_url || '',
    source: s.source || '',
    question_groups: groups,
  };
}

export default function AddSection() {
  const { id: editId } = useParams();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [existingSearch, setExistingSearch] = useState('');

  const [form, setForm] = useState({
    _id: '',
    title: '',
    content: '',
    audio_url: '',
    source: '',
    question_groups: [emptyQuestionGroup()],
  });

  // Collapsible state for question groups and questions
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [collapsedQuestions, setCollapsedQuestions] = useState(new Set());

  const toggleGroupCollapse = (groupIndex) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupIndex)) {
        next.delete(groupIndex);
      } else {
        next.add(groupIndex);
      }
      return next;
    });
  };

  const toggleQuestionCollapse = (groupIndex, questionIndex) => {
    const key = `${groupIndex}-${questionIndex}`;
    setCollapsedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  useEffect(() => {
    if (editId) {
      setLoading(true);
      setLoadError(null);
      api
        .getSectionById(editId)
        .then((res) => setForm(sectionToForm(res.data)))
        .catch((err) => setLoadError(err.message))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setForm({ _id: `section-${Date.now()}`, title: '', content: '', audio_url: '', source: '', question_groups: [emptyQuestionGroup()] });
    }
  }, [editId]);

  useEffect(() => {
    api.getSections().then((res) => setSections(res.data || [])).catch(() => setSections([]));
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

  const filteredSections = sections.filter((s) => matchSearch(s, existingSearch));

  const updateQuestionGroup = (groupIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, i) =>
        i === groupIndex ? { ...g, [key]: value } : g
      ),
    }));
  };

  const addQuestionGroup = () => {
    setForm((prev) => ({
      ...prev,
      question_groups: [...prev.question_groups, emptyQuestionGroup()],
    }));
  };

  const removeQuestionGroup = (groupIndex) => {
    if (form.question_groups.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.filter((_, i) => i !== groupIndex),
    }));
  };

  const updateQuestion = (groupIndex, questionIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) =>
        gi === groupIndex
          ? {
              ...g,
              questions: g.questions.map((q, qi) =>
                qi === questionIndex ? { ...q, [key]: value } : q
              ),
            }
          : g
      ),
    }));
  };

  const addQuestion = (groupIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) => {
        if (gi !== groupIndex) return g;
        const nextNum = g.questions.length + 1;
        return { ...g, questions: [...g.questions, emptyQuestion(nextNum)] };
      }),
    }));
  };

  const removeQuestion = (groupIndex, questionIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) => {
        if (gi !== groupIndex) return g;
        if (g.questions.length <= 1) return g;
        const questions = g.questions.filter((_, qi) => qi !== questionIndex);
        questions.forEach((q, i) => (q.q_number = i + 1));
        return { ...g, questions };
      }),
    }));
  };

  const setQuestionOption = (groupIndex, questionIndex, optionIndex, text) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) =>
        gi === groupIndex
          ? {
              ...g,
              questions: g.questions.map((q, qi) =>
                qi === questionIndex
                  ? {
                      ...q,
                      option: q.option.map((o, oi) =>
                        oi === optionIndex ? { ...o, text } : o
                      ),
                    }
                  : q
              ),
            }
          : g
      ),
    }));
  };

  const setCorrectAnswers = (groupIndex, questionIndex, value) => {
    const arr = value.split(',').map((s) => s.trim()).filter(Boolean);
    updateQuestion(groupIndex, questionIndex, 'correct_answers', arr.length ? arr : ['']);
  };

  const addHeading = (groupIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) =>
        gi === groupIndex
          ? { ...g, headings: [...(g.headings || []), emptyHeading()] }
          : g
      ),
    }));
  };

  const removeHeading = (groupIndex, headingIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) =>
        gi === groupIndex
          ? { ...g, headings: (g.headings || []).filter((_, hi) => hi !== headingIndex) }
          : g
      ),
    }));
  };

  const updateHeading = (groupIndex, headingIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) =>
        gi === groupIndex
          ? {
              ...g,
              headings: (g.headings || []).map((h, hi) =>
                hi === headingIndex ? { ...h, [key]: value } : h
              ),
            }
          : g
      ),
    }));
  };

  const handleDeleteSection = async (sectionId) => {
    if (!window.confirm('Delete this section? This cannot be undone.')) return;
    try {
      await api.deleteSection(sectionId);
      setSuccess('Section deleted.');
      const res = await api.getSections();
      setSections(res.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form._id.trim() || !form.title.trim() || !form.content.trim()) {
      setError('ID, title and content are required.');
      return;
    }
    const payload = {
      _id: form._id.trim(),
      title: form.title.trim(),
      content: form.content.trim(),
      audio_url: form.audio_url?.trim() || undefined,
      source: form.source.trim() || undefined,
      question_groups: form.question_groups.map((g) => ({
        type: g.type,
        instructions: g.instructions || undefined,
        headings: (g.headings || []).filter((h) => h.id && h.text).length
          ? (g.headings || []).filter((h) => h.id && h.text)
          : undefined,
        questions: g.questions.map((q) => ({
          q_number: q.q_number,
          text: q.text,
          option: q.option?.filter((o) => o.text) || [],
          correct_answers: q.correct_answers?.filter(Boolean) || [],
          explanation: q.explanation || undefined,
        })),
      })),
    };
    if (payload.question_groups.some((g) => !g.questions.length || g.questions.some((q) => !q.text || !q.correct_answers?.length))) {
      setError('Each question group must have at least one question with text and correct answer(s).');
      return;
    }
    const matchingFeaturesGroups = payload.question_groups.filter((g) => g.type === 'matching_features');
    if (matchingFeaturesGroups.some((g) => !g.headings?.length)) {
      setError('Matching features groups must have at least one feature (id + text).');
      return;
    }
    setSubmitLoading(true);
    try {
      if (editId) {
        await api.updateSection(editId, payload);
        setSuccess('Section updated.');
      } else {
        await api.createSection(payload);
        setSuccess('Section created.');
        setForm({
          _id: `section-${Date.now()}`,
          title: '',
          content: '',
          audio_url: '',
          source: '',
          question_groups: [emptyQuestionGroup()],
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (editId && loading) return <div className="manage-section"><p className="muted">Loading section...</p></div>;
  if (editId && loadError) return <div className="manage-section"><p className="form-error">{loadError}</p><Link to="/manage/sections">Back to sections</Link></div>;

  return (
    <div className="manage-section">
      <h2>{editId ? 'Edit section (Listening)' : 'Add section (Listening)'}</h2>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <form onSubmit={handleSubmit} className="manage-form">
        <div className="form-row">
          <label>Section ID *</label>
          <input
            value={form._id}
            onChange={(e) => updateForm('_id', e.target.value)}
            placeholder="e.g. section-1"
            required
            readOnly={!!editId}
          />
        </div>
        <div className="form-row">
          <label>Title *</label>
          <input
            value={form.title}
            onChange={(e) => updateForm('title', e.target.value)}
            placeholder="Section title"
            required
          />
        </div>
        <div className="form-row">
          <label>Content * (e.g. transcript or script)</label>
          <textarea
            value={form.content}
            onChange={(e) => updateForm('content', e.target.value)}
            placeholder="Listening section content..."
            rows={6}
            required
          />
        </div>
        <div className="form-row">
          <label>Audio URL (MP3 file for listening)</label>
          <input
            type="url"
            value={form.audio_url}
            onChange={(e) => updateForm('audio_url', e.target.value)}
            placeholder="https://example.com/audio.mp3"
          />
          <small className="form-hint">
            Enter the URL to the MP3 audio file for this listening section
          </small>
        </div>
        <div className="form-row">
          <label>Source</label>
          <input
            value={form.source}
            onChange={(e) => updateForm('source', e.target.value)}
            placeholder="Optional"
          />
        </div>

        <h3>Question groups</h3>
        {form.question_groups.map((group, gi) => {
          const isGroupCollapsed = collapsedGroups.has(gi);
          return (
            <div key={gi} className={`question-group-block ${isGroupCollapsed ? 'collapsed' : ''}`}>
              <div className="block-header">
                <span className="group-title">Group {gi + 1}</span>
                <div className="block-actions">
                  <button type="button" className="btn btn-ghost btn-sm collapse-btn" onClick={() => toggleGroupCollapse(gi)}>
                    {isGroupCollapsed ? '▼ Expand' : '▲ Collapse'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => removeQuestionGroup(gi)} disabled={form.question_groups.length <= 1}>
                    Remove group
                  </button>
                </div>
              </div>
              {!isGroupCollapsed && (
                <>
                  <div className="form-row">
                    <label>Type</label>
                    <select
                      value={group.type}
                      onChange={(e) => updateQuestionGroup(gi, 'type', e.target.value)}
                    >
                      {QUESTION_GROUP_TYPES.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Instructions</label>
                    <textarea
                      value={group.instructions}
                      onChange={(e) => updateQuestionGroup(gi, 'instructions', e.target.value)}
                      rows={2}
                    />
                  </div>

                  {group.type === 'matching_features' && (
                    <>
                      <h4>Features (list to match - e.g. i, ii, iii or A, B, C)</h4>
                      <p className="form-hint">Add options that will be shown. Each question's correct answer is the option id (e.g. i, ii, iii).</p>
                      {(group.headings || []).map((h, hi) => (
                        <div key={hi} className="heading-row">
                          <input
                            value={h.id}
                            onChange={(e) => updateHeading(gi, hi, 'id', e.target.value)}
                            placeholder="e.g. i, ii, iii"
                            className="heading-id"
                          />
                          <input
                            value={h.text}
                            onChange={(e) => updateHeading(gi, hi, 'text', e.target.value)}
                            placeholder="Feature text"
                            className="heading-text"
                          />
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => removeHeading(gi, hi)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-ghost" onClick={() => addHeading(gi)}>
                        + Add feature
                      </button>
                    </>
                  )}

                  <h4>Questions</h4>
                  {group.questions.map((q, qi) => {
                    const isQuestionCollapsed = collapsedQuestions.has(`${gi}-${qi}`);
                    return (
                      <div key={qi} className={`question-block ${isQuestionCollapsed ? 'collapsed' : ''}`}>
                        <div className="question-block-header">
                          <span className="question-label">Q{q.q_number}</span>
                          <button type="button" className="btn btn-ghost btn-sm collapse-btn" onClick={() => toggleQuestionCollapse(gi, qi)}>
                            {isQuestionCollapsed ? '▼ Expand' : '▲ Collapse'}
                          </button>
                        </div>
                        {!isQuestionCollapsed && (
                          <>
                            <div className="form-row">
                              <label>Q{q.q_number} - Question text *</label>
                              <textarea
                                value={q.text}
                                onChange={(e) => updateQuestion(gi, qi, 'text', e.target.value)}
                                rows={2}
                              />
                            </div>
                            {(group.type === 'mult_choice' || group.type === 'true_false_notgiven') && (
                              <div className="form-row options-row">
                                <label>Options</label>
                                {q.option?.map((opt, oi) => (
                                  <input
                                    key={oi}
                                    value={opt.text}
                                    onChange={(e) => setQuestionOption(gi, qi, oi, e.target.value)}
                                    placeholder={`Option ${opt.label}`}
                                  />
                                ))}
                              </div>
                            )}
                            <div className="form-row">
                              <label>Correct answer(s) * (comma-separated)</label>
                              <input
                                value={q.correct_answers?.join(', ') ?? ''}
                                onChange={(e) => setCorrectAnswers(gi, qi, e.target.value)}
                              />
                            </div>
                            <div className="form-row">
                              <label>Explanation</label>
                              <input
                                value={q.explanation ?? ''}
                                onChange={(e) => updateQuestion(gi, qi, 'explanation', e.target.value)}
                              />
                            </div>
                          </>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeQuestion(gi, qi)} disabled={group.questions.length <= 1}>
                          Remove question
                        </button>
                      </div>
                    );
                  })}
                  <button type="button" className="btn btn-ghost" onClick={() => addQuestion(gi)}>
                    + Add question
                  </button>
                </>
              )}
            </div>
          );
        })}
        <button type="button" className="btn btn-ghost" onClick={addQuestionGroup}>
          + Add question group
        </button>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitLoading}>
            {submitLoading ? (editId ? 'Saving...' : 'Creating...') : (editId ? 'Update section' : 'Create section')}
          </button>
          {editId && <Link to="/manage/sections" className="btn btn-ghost" style={{ marginLeft: '0.5rem' }}>Cancel</Link>}
        </div>
      </form>

      <h3>Existing sections</h3>
      {!editId && (loading ? <p className="muted">Loading...</p> : (
        <>
          <input
            type="search"
            value={existingSearch}
            onChange={(e) => setExistingSearch(e.target.value)}
            placeholder="Search sections by title or ID..."
            className="search-input"
            aria-label="Search existing sections"
          />
          {existingSearch.trim() && (
            <p className="search-hint">
              Showing {filteredSections.length} of {sections.length} section{sections.length !== 1 ? 's' : ''}
            </p>
          )}
          <ul className="manage-list">
            {sections.length === 0 ? <li className="muted">No sections yet.</li> : filteredSections.length === 0 ? (
              <li className="muted">No sections match your search.</li>
            ) : filteredSections.map((s) => (
              <li key={s._id}>
                <span>{s.title}</span>
                <code>{s._id}</code>
                <Link to={`/manage/sections/${s._id}`} className="edit-link">Edit</Link>
                <button type="button" className="btn btn-ghost btn-sm delete-link" onClick={() => handleDeleteSection(s._id)}>Delete</button>
              </li>
            ))}
          </ul>
        </>
      ))}
    </div>
  );
}
