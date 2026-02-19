import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import './Manage.css';
import { useNotification } from '@/shared/context/NotificationContext';
import AIContentGeneratorModal from '@/shared/components/AIContentGeneratorModal';
import QuestionGroup from './QuestionGroup';
import { PASSAGE_QUESTION_TYPE_OPTIONS, PLACEHOLDER_FROM_PASSAGE_CONTENT_TYPES } from './questionGroupConfig';
import { buildQuestionsFromPlaceholders, parseCorrectAnswersRaw } from './manageQuestionInputUtils';
import { X } from 'lucide-react';


const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function canonicalizeQuestionType(type = '') {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'matching_info') return 'matching_information';
  if (normalized === 'gap_fill') return 'note_completion';
  return normalized || 'mult_choice';
}

function emptyQuestion(qNumber = 1) {
  return {
    q_number: qNumber,
    text: '',
    option: OPTION_LABELS.map((label) => ({ label, text: '' })),
    correct_answers_raw: '',
    correct_answers: [''],
    explanation: '',
    passage_reference: '',
  };
}

function emptyHeading() {
  return { id: '', text: '' };
}

function emptyOption() {
  return { id: '', text: '' };
}

const handleBoldShortcut = (event, value, applyValue) => {
  const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
  const isBoldKey = key === 'b' || event.code === 'KeyB' || event.keyCode === 66 || event.which === 66;
  if (!(event.ctrlKey || event.metaKey) || !isBoldKey) return;
  event.preventDefault();
  event.stopPropagation();

  const target = event.target;
  const textValue = value ?? '';
  const start = target.selectionStart ?? 0;
  const end = target.selectionEnd ?? 0;
  const before = textValue.slice(0, start);
  const selected = textValue.slice(start, end);
  const after = textValue.slice(end);

  let nextValue = '';
  let nextStart = start;
  let nextEnd = start;

  if (selected.length) {
    nextValue = `${before}<strong>${selected}</strong>${after}`;
    nextStart = start + 8;
    nextEnd = nextStart + selected.length;
  } else {
    nextValue = `${before}<strong></strong>${after}`;
    nextStart = start + 8;
    nextEnd = nextStart;
  }

  applyValue(nextValue);
  requestAnimationFrame(() => {
    if (!target) return;
    target.selectionStart = nextStart;
    target.selectionEnd = nextEnd;
  });
};

function emptyQuestionGroup() {
  return {
    type: 'mult_choice',
    group_layout: 'default',
    required_count: '',
    use_once: false,
    instructions: '',
    headings: [],
    options: [],
    text: '',
    questions: [emptyQuestion(1)],
  };
}

function passageToForm(p) {
  if (!p) return { _id: '', title: '', content: '', source: '', isActive: true, question_groups: [emptyQuestionGroup()] };
  const groups = p.question_groups && p.question_groups.length
    ? p.question_groups.map((g) => ({
      type: canonicalizeQuestionType(g.type),
      group_layout: g.group_layout || 'default',
      required_count: g.required_count ?? '',
      use_once: Boolean(g.use_once),
      instructions: g.instructions || '',
      text: g.text || '',
      headings: (g.headings || []).map((h) => ({ id: h.id || '', text: h.text || '' })),
      options: (g.options || []).map((o) => ({ id: o.id || '', text: o.text || '' })),
      questions: (g.questions || []).map((q, i) => ({
        q_number: q.q_number ?? i + 1,
        text: q.text || '',
        option: (q.option && q.option.length > 0)
          ? q.option.map(o => ({ label: o.label, text: o.text || '' }))
          : OPTION_LABELS.map((label) => ({ label, text: '' })),
        correct_answers_raw: (q.correct_answers && q.correct_answers.length) ? q.correct_answers.join(', ') : '',
        correct_answers: (q.correct_answers && q.correct_answers.length) ? [...q.correct_answers] : [''],
        explanation: q.explanation || '',
        passage_reference: q.passage_reference || '',
      })),
    }))
    : [emptyQuestionGroup()];
  return {
    _id: p._id || '',
    title: p.title || '',
    content: p.content || '',
    source: p.source || '',
    isActive: p.isActive ?? true, // Mock field for UI
    createdAt: p.createdAt,
    question_groups: groups,
  };
}

export default function AddEditPassage({ editIdOverride = null, embedded = false, hideExistingList = false, onSaved = null, onCancel = null }) {
  const { id: routeEditId } = useParams();
  const normalizedRouteEditId = routeEditId === 'new' ? null : routeEditId;
  const editId = editIdOverride ?? normalizedRouteEditId;
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [passages, setPassages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [existingSearch, setExistingSearch] = useState('');
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  // Form State
  const [form, setForm] = useState({
    _id: '',
    title: '',
    content: '',
    source: '',
    isActive: true,
    question_groups: [emptyQuestionGroup()],
  });

  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [collapsedQuestions, setCollapsedQuestions] = useState(new Set());

  // --- Handlers ---

  const toggleGroupCollapse = (groupIndex) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupIndex)) next.delete(groupIndex);
      else next.add(groupIndex);
      return next;
    });
  };

  const toggleQuestionCollapse = (groupIndex, questionIndex) => {
    const key = `${groupIndex}-${questionIndex}`;
    setCollapsedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
        .catch((err) => {
          setLoadError(err.message);
          showNotification('Error loading passage: ' + err.message, 'error');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setForm({ _id: `passage-${Date.now()}`, title: '', content: '', source: '', isActive: true, question_groups: [emptyQuestionGroup()] });
    }
  }, [editId]);

  useEffect(() => {
    if (!hideExistingList) {
      api.getPassages().then((res) => setPassages(res.data || [])).catch(() => setPassages([]));
    }
  }, [editId, hideExistingList]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleAIGenerated = (data) => {
    const normalized = passageToForm(data);
    setForm(prev => ({
      ...prev,
      title: normalized.title || prev.title,
      content: normalized.content || prev.content,
      source: normalized.source || prev.source,
      question_groups: normalized.question_groups || prev.question_groups
    }));
    showNotification('Content generated successfully!', 'success');
  };

  // --- Question Group Handlers ---

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
    if (window.confirm('Are you sure you want to remove this group?')) {
      setForm((prev) => ({
        ...prev,
        question_groups: prev.question_groups.filter((_, i) => i !== groupIndex),
      }));
    }
  };

  const moveGroup = (idx, step) => {
    const newIdx = idx + step;
    if (newIdx < 0 || newIdx >= form.question_groups.length) return;
    const groups = [...form.question_groups];
    const item = groups.splice(idx, 1)[0];
    groups.splice(newIdx, 0, item);
    updateForm('question_groups', groups);
  };

  // --- Question Handlers ---

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

  // --- Option Handlers ---

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
    const parsed = parseCorrectAnswersRaw(value);

    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, gi) =>
        gi === groupIndex
          ? {
            ...group,
            questions: group.questions.map((question, qi) =>
              qi === questionIndex
                ? {
                  ...question,
                  correct_answers_raw: value,
                  correct_answers: parsed.length ? parsed : [''],
                }
                : question
            ),
          }
          : group
      ),
    }));
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

  const addQuestionOption = (groupIndex, questionIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) =>
        gi === groupIndex
          ? {
            ...g,
            questions: g.questions.map((q, qi) => {
              if (qi !== questionIndex) return q;
              const currentOptions = q.option || [];
              const nextLabel = String.fromCharCode(65 + currentOptions.length); // A, B, C...
              return {
                ...q,
                option: [...currentOptions, { label: nextLabel, text: '' }]
              };
            }),
          }
          : g
      ),
    }));
  };

  const removeQuestionOption = (groupIndex, questionIndex, optionIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((g, gi) =>
        gi === groupIndex
          ? {
            ...g,
            questions: g.questions.map((q, qi) => {
              if (qi !== questionIndex) return q;
              // Filter out the specific option
              const filtered = (q.option || []).filter((_, oi) => oi !== optionIndex);
              // Re-label to ensure continuity (A, B, C...)
              const relabeled = filtered.map((o, i) => ({ ...o, label: String.fromCharCode(65 + i) }));
              return { ...q, option: relabeled };
            }),
          }
          : g
      ),
    }));
  };

  const setMultiSelectMode = (groupIndex, mode, count = null) => {
    setForm((prev) => {
      const groups = [...prev.question_groups];
      const group = { ...groups[groupIndex] };
      group.group_layout = mode;

      if (mode === 'checkbox' && count !== null) {
        const currentQuestions = group.questions || [];
        let newQuestions = [...currentQuestions];
        if (newQuestions.length < count) {
          let maxNum = 0;
          prev.question_groups.forEach(g => g.questions.forEach(q => { if (q.q_number > maxNum) maxNum = q.q_number; }));
          for (let i = newQuestions.length; i < count; i++) {
            maxNum++;
            newQuestions.push(emptyQuestion(maxNum));
          }
        } else if (newQuestions.length > count) {
          newQuestions = newQuestions.slice(0, count);
        }

        if (newQuestions.length > 0) {
          const templateOptions = newQuestions[0].option;
          newQuestions = newQuestions.map((q, i) => i === 0 ? q : { ...q, option: templateOptions });
        }
        group.questions = newQuestions;
      }
      groups[groupIndex] = group;
      return { ...prev, question_groups: groups };
    });
  };

  const syncQuestionsFromGroupText = (groupIndex) => {
    const targetGroup = form.question_groups[groupIndex];
    if (!targetGroup) return;

    const sourceText = PLACEHOLDER_FROM_PASSAGE_CONTENT_TYPES.has(targetGroup.type)
      ? (form.content || '')
      : (targetGroup.text || '');

    const nextQuestions = buildQuestionsFromPlaceholders({
      rawText: sourceText,
      existingQuestions: targetGroup.questions || [],
      createQuestion: (qNumber) => emptyQuestion(qNumber),
    });

    if (!nextQuestions.length) {
      showNotification('No placeholders found. Use [1], [2], ... in reference text.', 'warning');
      return;
    }

    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, index) => (
        index === groupIndex ? { ...group, questions: nextQuestions } : group
      )),
    }));
  };

  const syncMultiChoiceCount = (groupIndex, count) => {
    if (!Number.isFinite(count) || count < 2) {
      showNotification('Required count must be at least 2 for multi-choice.', 'warning');
      return;
    }
    setMultiSelectMode(groupIndex, 'checkbox', count);
  };

  const handleDeletePassage = async (passageId) => {
    if (!window.confirm('Delete this passage? This cannot be undone.')) return;
    try {
      await api.deletePassage(passageId);
      showNotification('Passage deleted.', 'success');
      const res = await api.getPassages();
      setPassages(res.data || []);
    } catch (err) {
      setError(err.message);
      showNotification('Error deleting passage: ' + err.message, 'error');
    }
  };

  const handleSaveDraft = () => {
    showNotification('Draft saved.', 'success');
  };

  const handleGenerateQuestionInsights = async () => {
    const trimmedContent = String(form.content || '').trim();
    if (!trimmedContent) {
      showNotification('Passage content is required before generating AI explanation.', 'warning');
      return;
    }

    const questionCount = form.question_groups.reduce((sum, group) => sum + (group.questions?.length || 0), 0);
    if (!questionCount) {
      showNotification('Please create at least one question before generating AI explanation.', 'warning');
      return;
    }

    setIsGeneratingInsights(true);
    try {
      const response = await api.generatePassageQuestionInsights({
        title: form.title || '',
        source: form.source || '',
        content: trimmedContent,
        overwrite_existing: true,
        question_groups: form.question_groups.map((group) => ({
          type: canonicalizeQuestionType(group.type),
          instructions: group.instructions || '',
          text: group.text || '',
          headings: group.headings || [],
          options: group.options || [],
          questions: (group.questions || []).map((question) => ({
            q_number: question.q_number,
            text: question.text || '',
            option: question.option || [],
            correct_answers: question.correct_answers || [],
            explanation: question.explanation || '',
            passage_reference: question.passage_reference || '',
          })),
        })),
      });

      const generatedRows = Array.isArray(response?.data?.questions) ? response.data.questions : [];
      if (!generatedRows.length) {
        showNotification('AI did not return any explanation updates for this passage.', 'warning');
        return;
      }

      const insightMap = new Map(
        generatedRows
          .filter((row) => Number.isInteger(row.group_index) && Number.isInteger(row.question_index))
          .map((row) => [`${row.group_index}:${row.question_index}`, row])
      );

      setForm((prev) => ({
        ...prev,
        question_groups: prev.question_groups.map((group, groupIndex) => ({
          ...group,
          questions: (group.questions || []).map((question, questionIndex) => {
            const insight = insightMap.get(`${groupIndex}:${questionIndex}`);
            if (!insight) return question;
            return {
              ...question,
              explanation: insight.explanation || question.explanation || '',
              passage_reference: insight.passage_reference || question.passage_reference || '',
            };
          }),
        })),
      }));

      const modelName = response?.data?.model || 'gemini-2.0-flash';
      showNotification(`Generated ${generatedRows.length} explanation(s) with ${modelName}.`, 'success');
    } catch (err) {
      if (String(err?.message || '').includes('404')) {
        showNotification('AI route not found (404). Please restart/update backend to include /api/passages/ai/question-insights.', 'error');
        return;
      }
      showNotification(`Failed to generate AI explanation: ${err.message}`, 'error');
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form._id.trim() || !form.title.trim() || !form.content.trim()) {
      showNotification('ID, title and content are required.', 'error');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        content: form.content.trim(),
        source: form.source.trim() || undefined,
        isActive: form.isActive, // Include in payload if backend accepts it
        question_groups: form.question_groups.map((g) => ({
          type: canonicalizeQuestionType(g.type),
          group_layout: g.group_layout,
          required_count: g.required_count ? Number(g.required_count) : undefined,
          use_once: Boolean(g.use_once),
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
            passage_reference: q.passage_reference || undefined,
          })),
        })),
      };
      if (editId) {
        await api.updatePassage(editId, payload);
        showNotification('Passage updated successfully.', 'success');
      } else {
        await api.createPassage(payload);
        showNotification('Passage created successfully.', 'success');
        if (!editIdOverride) {
          navigate(`/manage/passages/${form._id}`);
        }
      }
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      setError(err.message);
      showNotification(err.message, 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (editId && loading) return <div className="manage-container"><div className="loading-spinner"></div></div>;
  if (editId && loadError) return <div className="manage-container"><p className="form-error">{loadError}</p><Link to="/manage/passages">Back to passages</Link></div>;

  const totalQuestions = form.question_groups.reduce((acc, g) => acc + g.questions.length, 0);

  return (
    <div className="manage-container">
      {/* Header with Title and Actions */}
      <div className="manage-editor-topbar">
        <div className="manage-editor-title">
          <button
            type="button"
            className="manage-editor-close"
            onClick={() => { if (typeof onCancel === 'function') onCancel(); else navigate('/manage/passages'); }}
            title="Close editor"
          >
            <X size={18} />
          </button>
          <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{editId ? 'Edit Reading Passage' : 'Create Reading Passage'}</h1>
          <p className="muted" style={{ marginTop: '0.5rem' }}>Reading comprehension passage with question groups</p>
          </div>
        </div>

        <div className="manage-header-actions">
          <label className="status-toggle">
            {form.isActive ? 'Active' : 'Inactive'}
            <div className="switch">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => updateForm('isActive', e.target.checked)}
              />
              <span className="slider"></span>
            </div>
          </label>

          <button type="button" className="btn-ghost" onClick={handleSaveDraft}>Save Draft</button>

          <button
            type="button"
            className="btn-manage-add"
            onClick={handleSubmit}
            disabled={submitLoading}
            style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
          >
            {submitLoading ? 'Saving...' : 'Save Passage'}
          </button>
        </div>
      </div>

      <AIContentGeneratorModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onGenerated={handleAIGenerated}
        type="passage"
      />

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="manage-layout-columns">
        {/* LEFT COLUMN: Main Content */}
        <div className="manage-main">

          {/* Basic Information Card */}
          <div className="manage-card card-accent-purple">
            <h3>Basic Information</h3>
            <div className="manage-form">
              <div className="manage-input-group">
                <label className="manage-input-label">Passage ID</label>
                <input
                  className="manage-input-field"
                  value={form._id}
                  onChange={(e) => updateForm('_id', e.target.value)}
                  required
                  readOnly={!!editId}
                  placeholder="e.g., READ_AC_001"
                />
              </div>

              <div className="manage-input-group">
                <label className="manage-input-label">Title</label>
                <input
                  className="manage-input-field"
                  value={form.title}
                  onChange={(e) => updateForm('title', e.target.value)}
                  required
                  placeholder="Enter passage title"
                />
              </div>

              <div className="manage-input-group">
                <label className="manage-input-label">Source</label>
                <input
                  className="manage-input-field"
                  value={form.source}
                  onChange={(e) => updateForm('source', e.target.value)}
                  placeholder="e.g., Cambridge IELTS 18"
                />
              </div>

              <div className="manage-input-group">
                <label className="manage-input-label">Passage Content</label>
                <textarea
                  className="manage-input-field manage-textarea-large"
                  value={form.content}
                  onChange={(e) => updateForm('content', e.target.value)}
                  onKeyDown={(e) => handleBoldShortcut(e, form.content, (next) => updateForm('content', next))}
                  required
                  placeholder="Enter the full reading passage text here..."
                />
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-sm btn-ghost"
                    style={{ color: '#6366F1' }}
                    onClick={() => setIsAIModalOpen(true)}
                  >
                    ✨ Generate with AI
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Question Groups Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b' }}>Question Groups</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleGenerateQuestionInsights}
                  disabled={isGeneratingInsights}
                  style={{ fontSize: '0.85rem', borderColor: '#c7d2fe', color: '#4f46e5' }}
                >
                  {isGeneratingInsights ? 'Generating...' : 'Generate Explain + Reference (AI)'}
                </button>
                <button type="button" className="btn-manage-add" onClick={addQuestionGroup} style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}>
                  + Add Group
                </button>
              </div>
            </div>

            {form.question_groups.length === 0 ? (
              <div className="manage-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b', borderStyle: 'dashed' }}>
                <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>📄</div>
                <p>No question groups yet</p>
                <p className="muted">Click "Add Group" to create your first question group</p>
              </div>
            ) : (
              form.question_groups.map((group, gi) => (
                <QuestionGroup
                  key={gi}
                  group={group}
                  gi={gi}
                  totalGroups={form.question_groups.length}
                  isGroupCollapsed={collapsedGroups.has(gi)}
                  collapsedQuestions={collapsedQuestions}
                  questionTypeOptions={PASSAGE_QUESTION_TYPE_OPTIONS}
                  onToggleGroupCollapse={toggleGroupCollapse}
                  onToggleQuestionCollapse={toggleQuestionCollapse}
                  onMove={moveGroup}
                  onRemove={removeQuestionGroup}
                  onUpdateGroup={updateQuestionGroup}
                  onUpdateQuestion={updateQuestion}
                  onAddQuestion={addQuestion}
                  onRemoveQuestion={removeQuestion}
                  onSetQuestionOption={setQuestionOption}
                  onSetCorrectAnswers={setCorrectAnswers}
                  onAddHeading={addHeading}
                  onRemoveHeading={removeHeading}
                  onUpdateHeading={updateHeading}
                  onAddOption={addOption}
                  onRemoveOption={removeOption}
                  onUpdateOption={updateOption}
                  onAddQuestionOption={addQuestionOption}
                  onRemoveQuestionOption={removeQuestionOption}
                  onSyncQuestionsFromText={syncQuestionsFromGroupText}
                  onSyncMultiChoiceCount={syncMultiChoiceCount}
                  showPassageReferenceField={true}
                  handleBoldShortcut={(e, val, cb) => handleBoldShortcut(e, val, cb)}
                />
              ))
            )}

            {form.question_groups.length > 0 && (
              <button type="button" className="btn-manage-add" onClick={addQuestionGroup} style={{ width: '100%', marginTop: '1rem' }}>
                + Add Another Group
              </button>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Sidebar (Metadata & Tips) */}
        <div className="manage-sidebar-column">

          {/* Metadata Card */}
          <div className="manage-card">
            <h3>Metadata</h3>
            <div className="metadata-list">
              <div className="meta-item">
                <span className="meta-label">Created</span>
                <span className="meta-value">
                  {form.createdAt ? new Date(form.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              <div className="meta-item">
                <span className="meta-label">Status</span>
                <span className={`meta-badge ${form.isActive ? 'badge-active' : 'badge-draft'}`}>
                  {form.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="meta-item" style={{ marginTop: '0.5rem', background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.5rem' }}>
                <span className="meta-label">Total Questions</span>
                <span className="meta-value" style={{ fontSize: '1.2rem', color: '#6366F1' }}>{totalQuestions}</span>
              </div>

              <div className="meta-item" style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.5rem' }}>
                <span className="meta-label">Question Groups</span>
                <span className="meta-value" style={{ fontSize: '1.2rem' }}>{form.question_groups.length}</span>
              </div>
            </div>
          </div>

          {/* Tips Card */}
          <div className="manage-card tips-card">
            <h3>💡 Tips</h3>
            <ul className="tips-list">
              <li>Use clear and concise passage titles</li>
              <li>Organize questions by type and difficulty</li>
              <li>Always provide detailed explanations</li>
              <li>Test questions thoroughly before publishing</li>
              <li>Include source attribution when applicable</li>
            </ul>
          </div>

        </div>
      </div>

    </div>
  );
}
