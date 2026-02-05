import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import './Manage.css';

const QUESTION_GROUP_TYPES = [
  { value: 'mult_choice', label: 'Multiple choice' },
  { value: 'true_false_notgiven', label: 'True / False / Not given' },
  { value: 'gap_fill', label: 'Gap fill' },
  { value: 'matching_features', label: 'Matching features' },
  { value: 'summary_completion', label: 'Summary completion' },
];

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const Icons = {
  Listening: () => (
    <svg className="manage-nav-icon" style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V8z" />
    </svg>
  )
};

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

function emptyOption() {
  return { id: '', text: '' };
}



function emptyQuestionGroup() {
  return {
    type: 'mult_choice',
    instructions: '',
    headings: [],
    options: [],
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
      options: (g.options || []).map((o) => ({ id: o.id || '', text: o.text || '' })),
      text: g.text || '', // Ensure text is mapped for gap_fill/summary
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

  const addOption = (groupIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) =>
        gi === groupIndex
          ? { ...g, options: [...(g.options || []), emptyOption()] }
          : g
      ),
    }));
  };

  const removeOption = (groupIndex, optionIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) =>
        gi === groupIndex
          ? { ...g, options: (g.options || []).filter((_, oi) => oi !== optionIndex) }
          : g
      ),
    }));
  };

  const updateOption = (groupIndex, optionIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) =>
        gi === groupIndex
          ? {
            ...g,
            options: (g.options || []).map((o, oi) =>
              oi === optionIndex ? { ...o, [key]: value } : o
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
        options: (g.options || []).filter((o) => o.id && o.text).length
          ? (g.options || []).filter((o) => o.id && o.text)
          : undefined,
        text: g.text || undefined,
        questions: g.questions.map((q) => ({
          q_number: q.q_number,
          text: q.text,
          option: q.option?.filter((o) => o.text) || [],
          correct_answers: q.correct_answers?.filter(Boolean) || [],
          explanation: q.explanation || undefined,
        })),
      })),
    };
    if (payload.question_groups.some((g) => {
      if (!g.questions.length) return true;

      // Gap Fill and Summary Completion don't require Question Text
      if (g.type === 'summary_completion' || g.type === 'gap_fill') {
        return g.questions.some(q => !q.correct_answers?.length);
      }

      // Others require text
      return g.questions.some(q => !q.text || !q.correct_answers?.length);
    })) {
      setError('Each question group must have at least one question with correct answer(s). For standard questions, text is also required.');
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

  if (editId && loading) return <p className="muted">Loading section...</p>;
  if (editId && loadError) return <div className="manage-section"><p className="form-error">{loadError}</p><Link to="/manage/sections">Back to sections</Link></div>;

  return (
    <div className="manage-container">
      <h1>{editId ? 'Sửa Listening Section' : 'Thêm Listening Section'}</h1>
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
            <div key={gi} className="question-group-block">
              <div className="group-header" onClick={() => toggleGroupCollapse(gi)}>
                <div className="group-title">
                  <Icons.Listening /> Question Group {gi + 1} ({group.type})
                </div>
                <div className="item-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); removeQuestionGroup(gi); }} disabled={form.question_groups.length <= 1} style={{ color: '#ef4444' }}>
                    Remove
                  </button>
                  <span>{isGroupCollapsed ? '▼' : '▲'}</span>
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

                  {(group.type === 'summary_completion' || group.type === 'gap_fill') && (
                    <div className="form-row">
                      <label>{group.type === 'summary_completion' ? 'Summary' : 'Gap Fill'} Text (Use [q_number] for gaps, e.g. "The umpire needed a [33] to decide.")</label>
                      <textarea
                        value={group.text}
                        onChange={(e) => updateQuestionGroup(gi, 'text', e.target.value)}
                        placeholder="Enter the text with gaps like [1], [2]..."
                        rows={4}
                      />
                    </div>
                  )}

                  {(group.type === 'matching_headings' || group.type === 'matching_features') && (
                    <div className="form-section">
                      <h4>{group.type === 'matching_headings' ? 'Danh sách Headings' : 'Danh sách Features'}</h4>
                      <p className="form-hint">Thêm các lựa chọn để học viên nối. Đáp án đúng của mỗi câu hỏi sẽ là ID (ví dụ: i, ii, iii hoặc A, B, C).</p>
                      {(group.headings || []).map((h, hi) => (
                        <div key={hi} className="heading-row">
                          <input
                            value={h.id}
                            onChange={(e) => updateHeading(gi, hi, 'id', e.target.value)}
                            placeholder="ID"
                            className="heading-id"
                          />
                          <textarea
                            value={h.text}
                            onChange={(e) => updateHeading(gi, hi, 'text', e.target.value)}
                            placeholder="Nội dung heading hoặc feature..."
                            className="heading-text"
                            rows={1}
                            onInput={(e) => {
                              e.target.style.height = 'auto';
                              e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                          />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeHeading(gi, hi)} style={{ color: '#ef4444' }}>Xóa</button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => addHeading(gi)}>+ Thêm hàng mới</button>
                    </div>
                  )}

                  {group.type === 'summary_completion' && (
                    <div className="form-section">
                      <h4>Danh sách lựa chọn (nếu có)</h4>
                      <p className="form-hint">Nếu bài điền từ có danh sách từ cho sẵn, hãy thêm ở đây.</p>
                      {(group.options || []).map((o, oi) => (
                        <div key={oi} className="heading-row">
                          <input
                            value={o.id}
                            onChange={(e) => updateOption(gi, oi, 'id', e.target.value)}
                            placeholder="ID"
                            className="heading-id"
                          />
                          <textarea
                            value={o.text}
                            onChange={(e) => updateOption(gi, oi, 'text', e.target.value)}
                            placeholder="Nội dung lựa chọn..."
                            className="heading-text"
                            rows={1}
                            onInput={(e) => {
                              e.target.style.height = 'auto';
                              e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                          />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeOption(gi, oi)} style={{ color: '#ef4444' }}>Xóa</button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => addOption(gi)}>+ Thêm lựa chọn</button>
                    </div>
                  )}

                  <h4>{group.type === 'summary_completion' || group.type === 'gap_fill' ? 'Gap Answer Key' : 'Questions'}</h4>

                  {/* SIMPLIFIED VIEW FOR SUMMARY COMPLETION & GAP FILL */}
                  {(group.type === 'summary_completion' || group.type === 'gap_fill') ? (
                    <div className="gap-answers-list">
                      <p className="form-hint">Define the answer key for each gap number (e.g. Q33, Q34). The Q number must match the [number] in the text.</p>
                      <table className="gap-answers-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                            <th style={{ padding: '8px', width: '80px' }}>Gap #</th>
                            <th style={{ padding: '8px' }}>Correct Answer(s)</th>
                            <th style={{ padding: '8px' }}>Explanation (Optional)</th>
                            <th style={{ padding: '8px', width: '80px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.questions.map((q, qi) => (
                            <tr key={qi} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '8px' }}>
                                <input
                                  type="number"
                                  value={q.q_number}
                                  onChange={(e) => updateQuestion(gi, qi, 'q_number', parseInt(e.target.value) || 0)}
                                  style={{ width: '60px', padding: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '8px' }}>
                                <input
                                  value={q.correct_answers?.join(', ') ?? ''}
                                  onChange={(e) => setCorrectAnswers(gi, qi, e.target.value)}
                                  placeholder={group.type === 'summary_completion' ? "e.g. A" : "e.g. car, automobile"}
                                  style={{ width: '100%', padding: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '8px' }}>
                                <input
                                  value={q.explanation ?? ''}
                                  onChange={(e) => updateQuestion(gi, qi, 'explanation', e.target.value)}
                                  placeholder="Explanation"
                                  style={{ width: '100%', padding: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '8px' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => removeQuestion(gi, qi)}
                                  style={{ color: '#ef4444' }}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => addQuestion(gi)}>
                        + Add Gap Answer
                      </button>
                    </div>
                  ) : (
                    /* STANDARD QUESTION LIST FOR OTHER TYPES */
                    <>
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
                </>
              )
              }
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
      </form >

      <div className="search-container">
        <h3>Các bài Section hiện có</h3>
        {!editId && (
          loading ? <p className="muted">Đang tải...</p> : (
            <>
              <div className="search-box">
                <input
                  type="search"
                  value={existingSearch}
                  onChange={(e) => setExistingSearch(e.target.value)}
                  placeholder="Tìm kiếm theo tiêu đề hoặc ID..."
                  className="test-search-input"
                />
              </div>
              {existingSearch.trim() && (
                <p className="search-hint">
                  Đang hiện {filteredSections.length} trên {sections.length} bài
                </p>
              )}
              <div className="manage-list">
                {sections.length === 0 ? <p className="muted">Chưa có bài nào.</p> : filteredSections.length === 0 ? (
                  <p className="muted">Không tìm thấy bài phù hợp.</p>
                ) : filteredSections.map((s) => (
                  <div key={s._id} className="list-item">
                    <div className="item-info">
                      <span className="item-title">{s.title}</span>
                      <span className="item-meta">ID: {s._id}</span>
                    </div>
                    <div className="item-actions">
                      <Link to={`/manage/sections/${s._id}`} className="btn btn-ghost btn-sm">Sửa</Link>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteSection(s._id)} style={{ color: '#ef4444' }}>Xóa</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>
    </div >
  );
}
