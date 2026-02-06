import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import './Manage.css';

const Icons = {
  Writing: () => (
    <svg className="manage-nav-icon" style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  )
};

const QUESTION_GROUP_TYPES = [
  { value: 'mult_choice', label: 'Multiple choice' },
  { value: 'true_false_notgiven', label: 'True / False / Not given' },
  { value: 'gap_fill', label: 'Gap fill' },
  { value: 'matching_headings', label: 'Matching headings' },
  { value: 'matching_features', label: 'Matching features' },
  { value: 'summary_completion', label: 'Summary completion' },
  { value: 'listening_map', label: 'Listening Map' },
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
    api.getPassages().then((res) => setPassages(res.data || [])).catch(() => setPassages([]));
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

  const moveGroup = (idx, step) => {
    const newIdx = idx + step;
    if (newIdx < 0 || newIdx >= form.question_groups.length) return;
    const groups = [...form.question_groups];
    const item = groups.splice(idx, 1)[0];
    groups.splice(newIdx, 0, item);
    updateForm('question_groups', groups);
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
    setForm((prev) => {
      const g = prev.question_groups[groupIndex];
      const nextNum = getNextQuestionNumber(prev.question_groups);
      return {
        ...prev,
        question_groups: prev.question_groups.map((group, gi) =>
          gi === groupIndex
            ? { ...group, questions: [...group.questions, emptyQuestion(nextNum)] }
            : group
        ),
      };
    });
  };

  const removeQuestion = (groupIndex, questionIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) => {
        if (gi !== groupIndex) return g;
        if (g.questions.length <= 1) return g;
        return {
          ...g,
          questions: g.questions.filter((_, qi) => qi !== questionIndex),
        };
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
    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        content: form.content.trim(),
        source: form.source.trim() || undefined,
        question_groups: form.question_groups.map((g) => ({
          type: g.type,
          instructions: g.instructions || undefined,
          text: g.text || undefined,
          headings: (g.headings || []).filter((h) => h.id || h.text).length
            ? (g.headings || []).filter((h) => h.id || h.text)
            : undefined,
          options: (g.options || []).filter((o) => o.id || o.text).length
            ? (g.options || []).filter((o) => o.id || o.text)
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
      if (editId) {
        await api.updatePassage(editId, payload);
        setSuccess('Passage updated.');
      } else {
        await api.createPassage(payload);
        setSuccess('Passage created.');
        setForm({ _id: `passage-${Date.now()}`, title: '', content: '', source: '', question_groups: [emptyQuestionGroup()] });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (editId && loading) return <p className="muted">Loading passage...</p>;
  if (editId && loadError) return <div className="manage-container"><p className="form-error">{loadError}</p><Link to="/manage/passages">Back to passages</Link></div>;

  return (
    <div className="manage-container">
      <h1>{editId ? 'Sửa bài Reading' : 'Thêm bài Reading'}</h1>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <form onSubmit={handleSubmit} className="manage-form">
        <div className="form-row">
          <label>Mã bài đọc (ID) *</label>
          <input value={form._id} onChange={(e) => updateForm('_id', e.target.value)} required readOnly={!!editId} placeholder="e.g. passage-1" />
        </div>
        <div className="form-row">
          <label>Tiêu đề *</label>
          <input value={form.title} onChange={(e) => updateForm('title', e.target.value)} required placeholder="Tiêu đề bài đọc" />
        </div>
        <div className="form-row">
          <label>Nội dung * (Transcript/Content)</label>
          <textarea value={form.content} onChange={(e) => updateForm('content', e.target.value)} rows={8} required placeholder="Nội dung bài đọc..." />
        </div>
        <div className="form-row">
          <label>Nguồn bài đọc (Source)</label>
          <input value={form.source} onChange={(e) => updateForm('source', e.target.value)} placeholder="e.g. Cambridge IELTS 18" />
        </div>

        <h3 style={{ color: '#d03939', marginTop: '2rem' }}>Các nhóm câu hỏi</h3>
        {form.question_groups.map((group, gi) => {
          const isGroupCollapsed = collapsedGroups.has(gi);
          return (
            <div key={gi} className="question-group-block">
              <div className="group-header" onClick={() => toggleGroupCollapse(gi)} style={{ padding: '0.5rem 0.3rem', borderRadius: '0.5rem' }} >
                <div className="group-title p-4">
                  <Icons.Writing /> Question Group {gi + 1} ({group.type})
                </div>
                <div className="item-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); moveGroup(gi, -1); }} disabled={gi === 0}>▲</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); moveGroup(gi, 1); }} disabled={gi === form.question_groups.length - 1}>▼</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); removeQuestionGroup(gi); }} disabled={form.question_groups.length <= 1} style={{ color: '#ef4444', fontWeight: 700 }}>Xóa nhóm</button>
                  <span style={{ marginLeft: '0.5rem', opacity: 0.5 }}>{isGroupCollapsed ? '▼' : '▲'}</span>
                </div>
              </div>
              {!isGroupCollapsed && (
                <div className="group-content">
                  <div className="form-row">
                    <label>Loại câu hỏi</label>
                    <select value={group.type} onChange={(e) => updateQuestionGroup(gi, 'type', e.target.value)}>
                      {QUESTION_GROUP_TYPES.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Hướng dẫn (Instructions)</label>
                    <textarea value={group.instructions} onChange={(e) => updateQuestionGroup(gi, 'instructions', e.target.value)} rows={2} />
                  </div>

                  {(group.type === 'summary_completion' || group.type === 'gap_fill') && (
                    <div className="form-row">
                      <label>Nội dung đoạn văn có lỗ hổng (Ví dụ: [1], [2])</label>
                      <textarea value={group.text} onChange={(e) => updateQuestionGroup(gi, 'text', e.target.value)} rows={4} />
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
                      <h4>Danh sách lựa chọn (Options)</h4>
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

                  {group.questions.map((q, qi) => {
                    const isQuestionCollapsed = collapsedQuestions.has(`${gi}-${qi}`);
                    return (
                      <div key={qi} className="question-block" style={{ border: '1px solid #fdf4e3', background: '#FFF9F1', padding: '1rem', borderRadius: '1rem', marginBottom: '1.5rem' }}>
                        <div className="group-header" onClick={() => toggleQuestionCollapse(gi, qi)} style={{ padding: '0.5rem 0.3rem', borderRadius: '0.5rem', background: 'transparent', borderBottom: 'none' }}>
                          <span style={{ fontWeight: 800, color: '#d03939' }}>Câu {q.q_number}</span>
                          <span style={{ opacity: 0.5 }}>{isQuestionCollapsed ? '▼' : '▲'}</span>
                        </div>
                        {!isQuestionCollapsed && (
                          <div className="form-row">
                            <label>Nội dung câu hỏi</label>
                            <textarea value={q.text} onChange={(e) => updateQuestion(gi, qi, 'text', e.target.value)} rows={2} placeholder="Nhập câu hỏi..." />

                            {(group.type === 'mult_choice' || group.type === 'true_false_notgiven') && (
                              <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                                <label style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Các lựa chọn (Options)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '0.5rem' }}>
                                  {(q.option || []).map((o, oi) => (
                                    <div key={o.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                      <span style={{ fontWeight: 800, color: '#d03939', width: '25px' }}>{o.label}</span>
                                      <input
                                        value={o.text}
                                        onChange={(e) => setQuestionOption(gi, qi, oi, e.target.value)}
                                        placeholder={`Lựa chọn ${o.label}`}
                                        style={{ background: '#ffffff' }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <label>Đáp án đúng (ngăn cách bởi dấu phẩy)</label>
                              <input value={q.correct_answers.join(', ')} onChange={(e) => setCorrectAnswers(gi, qi, e.target.value)} placeholder="e.g. A hoặc Answer1, Answer2" style={{ background: '#ffffff' }} />
                            </div>
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <label>Giải thích</label>
                              <textarea value={q.explanation} onChange={(e) => updateQuestion(gi, qi, 'explanation', e.target.value)} rows={2} placeholder="Giải thích tại sao đây là đáp án đúng..." style={{ background: '#ffffff' }} />
                            </div>
                          </div>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeQuestion(gi, qi)} style={{ color: '#ef4444', marginTop: '1rem', fontWeight: 700 }}>✕ Xóa câu hỏi</button>
                      </div>
                    );
                  })}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => addQuestion(gi)}>+ Thêm câu hỏi</button>
                </div>
              )}
            </div>
          );
        })}
        <button type="button" className="btn-manage-add" onClick={addQuestionGroup}>+ Thêm nhóm câu hỏi</button>

        <div className="form-section">
          <button type="submit" className="btn-manage-add" disabled={submitLoading} style={{ width: '100%', justifyContent: 'center', fontSize: '1.1rem', padding: '1.25rem' }}>
            {submitLoading ? 'Đang lưu...' : (editId ? 'Cập nhật bài đọc' : 'Tạo bài đọc mới')}
          </button>
        </div>
      </form>

      <div className="search-container" style={{ marginTop: '4rem', paddingTop: '3rem', borderTop: '2px solid #FFF9F1' }}>
        <h3 style={{ color: '#d03939' }}>Danh sách bài Reading hiện có</h3>
        {!editId && (
          loading ? <p className="muted">Đang tải...</p> : (
            <>
              <div className="search-box">
                <input type="search" value={existingSearch} onChange={(e) => setExistingSearch(e.target.value)} placeholder="Tìm kiếm bài đọc..." className="test-search-input" />
              </div>
              <div className="manage-list">
                {filteredPassages.map((p) => (
                  <div key={p._id} className="list-item">
                    <div className="item-info">
                      <span className="item-title">{p.title}</span>
                      <span className="item-meta">ID: {p._id}</span>
                    </div>
                    <div className="item-actions">
                      <Link to={`/manage/passages/${p._id}`} className="btn btn-ghost btn-sm">Sửa</Link>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeletePassage(p._id)} style={{ color: '#ef4444' }}>Xóa</button>
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
