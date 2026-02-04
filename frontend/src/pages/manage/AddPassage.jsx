import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';

const QUESTION_GROUP_TYPES = [
  { value: 'mult_choice', label: 'Multiple choice' },
  { value: 'true_false_notgiven', label: 'True / False / Not given' },
  { value: 'gap_fill', label: 'Gap fill' },
  { value: 'matching_headings', label: 'Matching headings' },
  { value: 'matching_features', label: 'Matching features' },
  { value: 'summary_completion', label: 'Summary completion' },
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

function emptyOption() {
  return { id: '', text: '' };
}

function emptyQuestionGroup() {
  return {
    type: 'mult_choice',
    instructions: '',
    headings: [],
    options: [],
    text: '',
    questions: [emptyQuestion(1)],
  };
}

function passageToForm(p) {
  if (!p) return { _id: '', title: '', content: '', source: '', question_groups: [emptyQuestionGroup()] };
  const groups = p.question_groups && p.question_groups.length
    ? p.question_groups.map((g) => ({
        type: g.type || 'mult_choice',
        instructions: g.instructions || '',
        text: g.text || '',
        headings: (g.headings || []).map((h) => ({ id: h.id || '', text: h.text || '' })),
        options: (g.options || []).map((o) => ({ id: o.id || '', text: o.text || '' })),
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
    _id: p._id || '',
    title: p.title || '',
    content: p.content || '',
    source: p.source || '',
    question_groups: groups,
  };
}

export default function AddPassage() {
  const { id: editId } = useParams();
  const [passages, setPassages] = useState([]);
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
        .getPassageById(editId)
        .then((res) => setForm(passageToForm(res.data)))
        .catch((err) => setLoadError(err.message))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setForm({ _id: `passage-${Date.now()}`, title: '', content: '', source: '', question_groups: [emptyQuestionGroup()] });
    }
  }, [editId]);

  useEffect(() => {
    if (!editId) {
      api.getPassages().then((res) => setPassages(res.data || [])).catch(() => setPassages([]));
    } else {
      api.getPassages().then((res) => setPassages(res.data || [])).catch(() => setPassages([]));
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

  const filteredPassages = passages.filter((p) => matchSearch(p, existingSearch));

  const updateQuestionGroup = (groupIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, i) =>
        i === groupIndex ? { ...g, [key]: value } : g
      ),
    }));
  };

  // Helper to find the next available question number across ALL groups
  const getNextQuestionNumber = (currentQuestionGroups) => {
    let maxNum = 0;
    currentQuestionGroups.forEach(g => {
      g.questions.forEach(q => {
        if (q.q_number > maxNum) maxNum = q.q_number;
      });
    });
    return maxNum + 1;
  };

  const addQuestionGroup = () => {
    setForm((prev) => {
      const nextNum = getNextQuestionNumber(prev.question_groups);
      // Create new group with start question number
      const newGroup = emptyQuestionGroup();
      newGroup.questions[0].q_number = nextNum;
      
      return {
        ...prev,
        question_groups: [...prev.question_groups, newGroup],
      };
    });
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
        // Find next number globally, not just local length
        const nextNum = getNextQuestionNumber(prev.question_groups);
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

  // --- Handlers for Summary Options ---
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

  const moveGroup = (index, direction) => {
    setForm((prev) => {
      const groups = [...prev.question_groups];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= groups.length) return prev;
      
      const [movedGroup] = groups.splice(index, 1);
      groups.splice(newIndex, 0, movedGroup);
      return { ...prev, question_groups: groups };
    });
  };

  const handleDeletePassage = async (passageId) => {
    if (!window.confirm('Delete this passage? This cannot be undone.')) return;
    try {
      await api.deletePassage(passageId);
      setSuccess('Passage deleted.');
      const res = await api.getPassages();
      setPassages(res.data || []);
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
      source: form.source.trim() || undefined,
      question_groups: form.question_groups.map((g) => ({
        type: g.type,
        instructions: g.instructions || undefined,
        text: g.text || undefined,
        headings: (g.headings || []).filter((h) => h.id && h.text).length
          ? (g.headings || []).filter((h) => h.id && h.text)
          : undefined,
        options: (g.options || []).filter((o) => o.id && o.text).length
          ? (g.options || []).filter((o) => o.id && o.text)
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
    const invalidGroups = payload.question_groups.filter(g => {
        if (!g.questions.length) return true;
        
        // For standard types, text is required. For summary, it's not.
        if (g.type === 'summary_completion') {
           return g.questions.some(q => !q.correct_answers?.length);
        }
        
        return g.questions.some(q => !q.text || !q.correct_answers?.length);
    });

    if (invalidGroups.length > 0) {
      setError('Each question group must have at least one question with correct answer(s). For standard questions, text is also required.');
      return;
    }
    const matchingTypeGroups = payload.question_groups.filter(
      (g) => g.type === 'matching_headings' || g.type === 'matching_features'
    );
    if (matchingTypeGroups.some((g) => !g.headings?.length)) {
      setError('Matching headings / matching features groups must have at least one option (id + text).');
      return;
    }
    setSubmitLoading(true);
    try {
      if (editId) {
        await api.updatePassage(editId, payload);
        setSuccess('Passage updated.');
      } else {
        await api.createPassage(payload);
        setSuccess('Passage created.');
        setForm({
          _id: `passage-${Date.now()}`,
          title: '',
          content: '',
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

  if (editId && loading) return <div className="manage-section"><p className="muted">Loading passage...</p></div>;
  if (editId && loadError) return <div className="manage-section"><p className="form-error">{loadError}</p><Link to="/manage/passages">Back to passages</Link></div>;

  return (
    <div className="manage-section">
      <h2>{editId ? 'Edit passage (Reading)' : 'Add passage (Reading)'}</h2>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <form onSubmit={handleSubmit} className="manage-form">
        <div className="form-row">
          <label>Passage ID *</label>
          <input
            value={form._id}
            onChange={(e) => updateForm('_id', e.target.value)}
            placeholder="e.g. passage-1"
            required
            readOnly={!!editId}
          />
        </div>
        <div className="form-row">
          <label>Title *</label>
          <input
            value={form.title}
            onChange={(e) => updateForm('title', e.target.value)}
            placeholder="Passage title"
            required
          />
        </div>
        <div className="form-row">
          <label>Content *</label>
          <textarea
            value={form.content}
            onChange={(e) => updateForm('content', e.target.value)}
            placeholder="Reading passage text..."
            rows={6}
            required
          />
        </div>
        <div className="form-row">
          <label>Source</label>
          <input
            value={form.source}
            onChange={(e) => updateForm('source', e.target.value)}
            placeholder="Optional source"
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
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveGroup(gi, -1)} disabled={gi === 0} title="Move Up">
                    ▲
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveGroup(gi, 1)} disabled={gi === form.question_groups.length - 1} title="Move Down">
                    ▼
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm collapse-btn" onClick={() => toggleGroupCollapse(gi)}>
                    {isGroupCollapsed ? 'Expand' : 'Collapse'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => removeQuestionGroup(gi)} disabled={form.question_groups.length <= 1} style={{color: '#ef4444'}}>
                    Remove
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
                      placeholder="e.g. Choose the correct letter, A, B, C or D."
                      rows={2}
                    />
                  </div>
                  
                  {group.type === 'summary_completion' && (
                    <div className="form-row">
                      <label>Summary Text (Use [q_number] for gaps, e.g. "The umpire needed a [33] to decide.")</label>
                      <textarea
                        value={group.text}
                        onChange={(e) => updateQuestionGroup(gi, 'text', e.target.value)}
                        placeholder="Enter the summary text with gaps like [1], [2]..."
                        rows={4}
                      />
                    </div>
                  )}

                  {(group.type === 'matching_headings' || group.type === 'matching_features') && (
                    <>
                      <h4>{group.type === 'matching_headings' ? 'Headings' : 'Features'} (list to match - e.g. i, ii, iii or A, B, C)</h4>
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
                            placeholder="Heading text"
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
                        + Add {group.type === 'matching_headings' ? 'heading' : 'feature'}
                      </button>
                    </>
                  )}

                  {group.type === 'summary_completion' && (
                    <>
                      <h4>Options (list of phrases to fill in gaps)</h4>
                      <p className="form-hint">Add the list of phrases/words. Use IDs like A, B, C... The correct answer for each gap will be this ID.</p>
                      {(group.options || []).map((o, oi) => (
                        <div key={oi} className="heading-row">
                          <input
                            value={o.id}
                            onChange={(e) => updateOption(gi, oi, 'id', e.target.value)}
                            placeholder="e.g. A, B, C"
                            className="heading-id"
                          />
                          <input
                            value={o.text}
                            onChange={(e) => updateOption(gi, oi, 'text', e.target.value)}
                            placeholder="Option phrase"
                            className="heading-text"
                          />
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => removeOption(gi, oi)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-ghost" onClick={() => addOption(gi)}>
                        + Add option
                      </button>
                    </>
                  )}

                  <h4>{group.type === 'summary_completion' ? 'Gap Answer Key' : 'Questions'}</h4>
                  
                  {/* SIMPLIFIED VIEW FOR SUMMARY COMPLETION */}
                  {group.type === 'summary_completion' ? (
                     <div className="gap-answers-list">
                       <p className="form-hint">Define the answer key for each gap number (e.g. Q33, Q34). The Q number must match the [number] in the text.</p>
                       <table className="gap-answers-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                         <thead>
                           <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                             <th style={{ padding: '8px', width: '80px' }}>Gap #</th>
                             <th style={{ padding: '8px' }}>Correct Option ID</th>
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
                                   placeholder="e.g. A"
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
                                  <label>Q{q.q_number} - Question text {group.type !== 'summary_completion' && '*'}</label>
                                  {group.type === 'summary_completion' ? (
                                    <p className="form-item-note" style={{ color: '#666', fontStyle: 'italic', margin: '0' }}>
                                      (Not needed for Summary Completion. The question is the gap [{q.q_number}] in the summary text above.)
                                    </p>
                                  ) : (
                                    <textarea
                                      value={q.text}
                                      onChange={(e) => updateQuestion(gi, qi, 'text', e.target.value)}
                                      placeholder="Question text"
                                      rows={2}
                                    />
                                  )}
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
                                  <label>Correct answer(s) * (comma-separated for multiple)</label>
                                  <input
                                    value={q.correct_answers?.join(', ') ?? ''}
                                    onChange={(e) => setCorrectAnswers(gi, qi, e.target.value)}
                                    placeholder="e.g. A or car, automobile"
                                  />
                                </div>
                                <div className="form-row">
                                  <label>Explanation</label>
                                  <input
                                    value={q.explanation ?? ''}
                                    onChange={(e) => updateQuestion(gi, qi, 'explanation', e.target.value)}
                                    placeholder="Optional"
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
              )}
            </div>
          );
        })}
        <button type="button" className="btn btn-ghost" onClick={addQuestionGroup}>
          + Add question group
        </button>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitLoading}>
            {submitLoading ? (editId ? 'Saving...' : 'Creating...') : (editId ? 'Update passage' : 'Create passage')}
          </button>
          {editId && <Link to="/manage/passages" className="btn btn-ghost" style={{ marginLeft: '0.5rem' }}>Cancel</Link>}
        </div>
      </form>

      <h3>Existing passages</h3>
      {!editId && (loading ? <p className="muted">Loading...</p> : (
        <>
          <input
            type="search"
            value={existingSearch}
            onChange={(e) => setExistingSearch(e.target.value)}
            placeholder="Search passages by title or ID..."
            className="search-input"
            aria-label="Search existing passages"
          />
          {existingSearch.trim() && (
            <p className="search-hint">
              Showing {filteredPassages.length} of {passages.length} passage{passages.length !== 1 ? 's' : ''}
            </p>
          )}
          <ul className="manage-list">
            {passages.length === 0 ? <li className="muted">No passages yet.</li> : filteredPassages.length === 0 ? (
              <li className="muted">No passages match your search.</li>
            ) : filteredPassages.map((p) => (
              <li key={p._id}>
                <span>{p.title}</span>
                <code>{p._id}</code>
                <Link to={`/manage/passages/${p._id}`} className="edit-link">Edit</Link>
                <button type="button" className="btn btn-ghost btn-sm delete-link" onClick={() => handleDeletePassage(p._id)}>Delete</button>
              </li>
            ))}
          </ul>
        </>
      ))}
    </div>
  );
}
