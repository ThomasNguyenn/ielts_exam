import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import AIContentGeneratorModal from '@/shared/components/AIContentGeneratorModal';
import QuestionGroup from './QuestionGroup';
import { PLACEHOLDER_FROM_PASSAGE_CONTENT_TYPES, SECTION_QUESTION_TYPE_OPTIONS } from './questionGroupConfig';
import { buildQuestionsFromPlaceholders, parseCorrectAnswersRaw } from './manageQuestionInputUtils';
import { X } from 'lucide-react';
import './Manage.css';

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
    group_layout: 'default',
    required_count: '',
    use_once: false,
    instructions: '',
    text: '',
    headings: [],
    options: [],
    questions: [emptyQuestion(1)],
  };
}

function sectionToForm(section) {
  if (!section) {
    return {
      _id: '',
      title: '',
      content: '',
      audio_url: '',
      source: '',
      isActive: true,
      question_groups: [emptyQuestionGroup()],
    };
  }

  const groups = Array.isArray(section.question_groups) && section.question_groups.length
    ? section.question_groups.map((group) => ({
      type: canonicalizeQuestionType(group.type),
      group_layout: group.group_layout || 'default',
      required_count: group.required_count ?? '',
      use_once: Boolean(group.use_once),
      instructions: group.instructions || '',
      text: group.text || '',
      headings: Array.isArray(group.headings) ? group.headings.map((heading) => ({ id: heading.id || '', text: heading.text || '' })) : [],
      options: Array.isArray(group.options) ? group.options.map((option) => ({ id: option.id || '', text: option.text || '' })) : [],
      questions: Array.isArray(group.questions) && group.questions.length
        ? group.questions.map((question, index) => ({
          q_number: question.q_number ?? index + 1,
          text: question.text || '',
          option: Array.isArray(question.option) && question.option.length
            ? question.option.map((item) => ({ label: item.label, text: item.text || '' }))
            : OPTION_LABELS.map((label) => ({ label, text: '' })),
          correct_answers_raw: Array.isArray(question.correct_answers) && question.correct_answers.length
            ? question.correct_answers.join(', ')
            : '',
          correct_answers: Array.isArray(question.correct_answers) && question.correct_answers.length
            ? [...question.correct_answers]
            : [''],
          explanation: question.explanation || '',
        }))
        : [emptyQuestion(1)],
    }))
    : [emptyQuestionGroup()];

  return {
    _id: section._id || '',
    title: section.title || '',
    content: section.content || '',
    audio_url: section.audio_url || '',
    source: section.source || '',
    isActive: section.is_active ?? true,
    createdAt: section.createdAt || section.created_at,
    question_groups: groups,
  };
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

export default function AddSection({ editIdOverride = null, embedded = false, onSaved = null, onCancel = null }) {
  const { id: routeEditId } = useParams();
  const normalizedRouteEditId = routeEditId === 'new' ? null : routeEditId;
  const editId = editIdOverride ?? normalizedRouteEditId;
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [form, setForm] = useState({
    _id: '',
    title: '',
    content: '',
    audio_url: '',
    source: '',
    isActive: true,
    question_groups: [emptyQuestionGroup()],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [collapsedQuestions, setCollapsedQuestions] = useState(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (editId) {
          const response = await api.getSectionById(editId);
          setForm(sectionToForm(response.data));
        } else {
          setForm({
            _id: `section-${Date.now()}`,
            title: '',
            content: '',
            audio_url: '',
            source: '',
            isActive: true,
            question_groups: [emptyQuestionGroup()],
          });
        }
      } catch (loadErr) {
        setLoadError(loadErr.message);
        showNotification(`Error loading section: ${loadErr.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [editId, showNotification]);

  const totalQuestions = useMemo(
    () => form.question_groups.reduce((sum, group) => sum + (group.questions?.length || 0), 0),
    [form.question_groups]
  );

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleGroupCollapse = (groupIndex) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupIndex)) next.delete(groupIndex);
      else next.add(groupIndex);
      return next;
    });
  };

  const toggleQuestionCollapse = (groupIndex, questionIndex) => {
    const key = `${groupIndex}-${questionIndex}`;
    setCollapsedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getNextQuestionNumber = (questionGroups) => {
    let max = 0;
    questionGroups.forEach((group) => {
      (group.questions || []).forEach((question) => {
        if ((question.q_number || 0) > max) max = question.q_number;
      });
    });
    return max + 1;
  };

  const updateQuestionGroup = (groupIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, index) => (
        index === groupIndex ? { ...group, [key]: value } : group
      )),
    }));
  };

  const addQuestionGroup = () => {
    setForm((prev) => {
      const nextNumber = getNextQuestionNumber(prev.question_groups);
      const nextGroup = emptyQuestionGroup();
      nextGroup.questions[0].q_number = nextNumber;
      return {
        ...prev,
        question_groups: [...prev.question_groups, nextGroup],
      };
    });
  };

  const removeQuestionGroup = (groupIndex) => {
    if (!window.confirm('Delete this question group?')) return;
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.filter((_, index) => index !== groupIndex),
    }));
  };

  const moveGroup = (index, step) => {
    const nextIndex = index + step;
    if (nextIndex < 0 || nextIndex >= form.question_groups.length) return;
    const groups = [...form.question_groups];
    const [item] = groups.splice(index, 1);
    groups.splice(nextIndex, 0, item);
    updateForm('question_groups', groups);
  };

  const updateQuestion = (groupIndex, questionIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => (
        groupIdx === groupIndex
          ? {
            ...group,
            questions: group.questions.map((question, questionIdx) => (
              questionIdx === questionIndex ? { ...question, [key]: value } : question
            )),
          }
          : group
      )),
    }));
  };

  const addQuestion = (groupIndex) => {
    setForm((prev) => {
      const nextNumber = getNextQuestionNumber(prev.question_groups);
      return {
        ...prev,
        question_groups: prev.question_groups.map((group, groupIdx) => (
          groupIdx === groupIndex
            ? { ...group, questions: [...group.questions, emptyQuestion(nextNumber)] }
            : group
        )),
      };
    });
  };

  const removeQuestion = (groupIndex, questionIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => {
        if (groupIdx !== groupIndex) return group;
        if (group.questions.length <= 1) return group;
        return {
          ...group,
          questions: group.questions.filter((_, index) => index !== questionIndex),
        };
      }),
    }));
  };

  const setQuestionOption = (groupIndex, questionIndex, optionIndex, text) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => (
        groupIdx === groupIndex
          ? {
            ...group,
            questions: group.questions.map((question, questionIdx) => (
              questionIdx === questionIndex
                ? {
                  ...question,
                  option: question.option.map((option, idx) => (idx === optionIndex ? { ...option, text } : option)),
                }
                : question
            )),
          }
          : group
      )),
    }));
  };

  const setCorrectAnswers = (groupIndex, questionIndex, value) => {
    const parsed = parseCorrectAnswersRaw(value);

    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => (
        groupIdx === groupIndex
          ? {
            ...group,
            questions: group.questions.map((question, questionIdx) => (
              questionIdx === questionIndex
                ? {
                  ...question,
                  correct_answers_raw: value,
                  correct_answers: parsed.length ? parsed : [''],
                }
                : question
            )),
          }
          : group
      )),
    }));
  };

  const addHeading = (groupIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => (
        groupIdx === groupIndex
          ? { ...group, headings: [...(group.headings || []), emptyHeading()] }
          : group
      )),
    }));
  };

  const removeHeading = (groupIndex, headingIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => (
        groupIdx === groupIndex
          ? { ...group, headings: (group.headings || []).filter((_, idx) => idx !== headingIndex) }
          : group
      )),
    }));
  };

  const updateHeading = (groupIndex, headingIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => (
        groupIdx === groupIndex
          ? {
            ...group,
            headings: (group.headings || []).map((heading, idx) => (
              idx === headingIndex ? { ...heading, [key]: value } : heading
            )),
          }
          : group
      )),
    }));
  };

  const addOption = (groupIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => (
        groupIdx === groupIndex
          ? { ...group, options: [...(group.options || []), emptyOption()] }
          : group
      )),
    }));
  };

  const removeOption = (groupIndex, optionIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => (
        groupIdx === groupIndex
          ? { ...group, options: (group.options || []).filter((_, idx) => idx !== optionIndex) }
          : group
      )),
    }));
  };

  const updateOption = (groupIndex, optionIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => (
        groupIdx === groupIndex
          ? {
            ...group,
            options: (group.options || []).map((option, idx) => (idx === optionIndex ? { ...option, [key]: value } : option)),
          }
          : group
      )),
    }));
  };

  const addQuestionOption = (groupIndex, questionIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => (
        groupIdx === groupIndex
          ? {
            ...group,
            questions: group.questions.map((question, questionIdx) => {
              if (questionIdx !== questionIndex) return question;
              const nextLabel = String.fromCharCode(65 + (question.option?.length || 0));
              return {
                ...question,
                option: [...(question.option || []), { label: nextLabel, text: '' }],
              };
            }),
          }
          : group
      )),
    }));
  };

  const removeQuestionOption = (groupIndex, questionIndex, optionIndex) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => (
        groupIdx === groupIndex
          ? {
            ...group,
            questions: group.questions.map((question, questionIdx) => {
              if (questionIdx !== questionIndex) return question;
              const filtered = (question.option || []).filter((_, index) => index !== optionIndex);
              return {
                ...question,
                option: filtered.map((item, index) => ({ ...item, label: String.fromCharCode(65 + index) })),
              };
            }),
          }
          : group
      )),
    }));
  };

  const setMultiSelectMode = (groupIndex, mode, count = null) => {
    setForm((prev) => {
      const groups = [...prev.question_groups];
      const group = { ...groups[groupIndex] };
      group.group_layout = mode;

      if (mode === 'checkbox' && count !== null) {
        let nextQuestions = [...(group.questions || [])];
        if (nextQuestions.length < count) {
          let nextNumber = getNextQuestionNumber(prev.question_groups);
          for (let index = nextQuestions.length; index < count; index += 1) {
            nextQuestions.push(emptyQuestion(nextNumber));
            nextNumber += 1;
          }
        } else if (nextQuestions.length > count) {
          nextQuestions = nextQuestions.slice(0, count);
        }

        if (nextQuestions.length > 0) {
          const templateOptions = nextQuestions[0].option;
          nextQuestions = nextQuestions.map((question, index) => (
            index === 0 ? question : { ...question, option: templateOptions }
          ));
        }
        group.questions = nextQuestions;
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

  const handleAIGenerated = (generatedData) => {
    const normalized = sectionToForm(generatedData);
    setForm((prev) => ({
      ...prev,
      title: normalized.title || prev.title,
      content: normalized.content || prev.content,
      source: normalized.source || prev.source,
      audio_url: normalized.audio_url || prev.audio_url,
      question_groups: normalized.question_groups.length ? normalized.question_groups : prev.question_groups,
    }));
    showNotification('Section generated successfully.', 'success');
  };

  const handleSaveDraft = () => {
    showNotification('Draft saved.', 'success');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!form._id.trim() || !form.title.trim() || !form.content.trim()) {
      showNotification('ID, title, and content are required.', 'error');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        content: form.content.trim(),
        audio_url: form.audio_url?.trim() || undefined,
        source: form.source?.trim() || undefined,
        is_active: form.isActive,
        question_groups: form.question_groups.map((group) => ({
          type: canonicalizeQuestionType(group.type),
          group_layout: group.group_layout || 'default',
          required_count: group.required_count ? Number(group.required_count) : undefined,
          use_once: Boolean(group.use_once),
          instructions: group.instructions || undefined,
          text: group.text || undefined,
          headings: (group.headings || []).filter((heading) => heading.id || heading.text).length
            ? (group.headings || []).filter((heading) => heading.id || heading.text)
            : undefined,
          options: (group.options || []).filter((option) => option.id || option.text).length
            ? (group.options || []).filter((option) => option.id || option.text)
            : undefined,
          questions: (group.questions || []).map((question) => ({
            q_number: Number(question.q_number) || 0,
            text: question.text || '',
            option: (question.option || []).filter((option) => option.text),
            correct_answers: (question.correct_answers || []).filter(Boolean),
            explanation: question.explanation || undefined,
          })),
        })),
      };

      if (editId) {
        await api.updateSection(editId, payload);
        showNotification('Section updated successfully.', 'success');
      } else {
        await api.createSection(payload);
        showNotification('Section created successfully.', 'success');
        if (!editIdOverride) {
          navigate(`/manage/sections/${form._id}`);
        }
      }

      if (typeof onSaved === 'function') onSaved();
    } catch (submitErr) {
      setError(submitErr.message);
      showNotification(submitErr.message, 'error');
    } finally {
      setSubmitLoading(false);
    }
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
              else navigate('/manage/sections');
            }}
            title="Close editor"
          >
            <X size={18} />
          </button>
          <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{editId ? 'Edit Listening Section' : 'Create Listening Section'}</h1>
          <p className="muted" style={{ marginTop: '0.5rem' }}>Listening comprehension section with question groups and audio.</p>
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
            {submitLoading ? 'Saving...' : 'Save Section'}
          </button>
        </div>
      </div>

      <AIContentGeneratorModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onGenerated={handleAIGenerated}
        type="section"
      />

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="manage-layout-columns">
        <div className="manage-main">
          <div className="manage-card card-accent-blue">
            <h3>Basic Information</h3>

            <div className="manage-input-group">
              <label className="manage-input-label">Section ID</label>
              <input
                className="manage-input-field"
                value={form._id}
                onChange={(event) => updateForm('_id', event.target.value)}
                readOnly={!!editId}
                placeholder="e.g., LIST_SEC_001"
              />
            </div>

            <div className="manage-input-group">
              <label className="manage-input-label">Title</label>
              <input
                className="manage-input-field"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                placeholder="Enter section title"
              />
            </div>

            <div className="manage-input-group">
              <label className="manage-input-label">Source</label>
              <input
                className="manage-input-field"
                value={form.source}
                onChange={(event) => updateForm('source', event.target.value)}
                placeholder="e.g., Cambridge IELTS 18"
              />
            </div>

            <div className="manage-input-group">
              <label className="manage-input-label">Audio URL</label>
              <input
                className="manage-input-field"
                value={form.audio_url}
                onChange={(event) => updateForm('audio_url', event.target.value)}
                placeholder="https://example.com/audio.mp3"
              />
            </div>

            <div className="manage-input-group">
              <label className="manage-input-label">Context / Description</label>
              <textarea
                className="manage-input-field"
                value={form.content}
                onChange={(event) => updateForm('content', event.target.value)}
                onKeyDown={(event) => handleBoldShortcut(event, form.content, (next) => updateForm('content', next))}
                rows={5}
                placeholder="Brief context for this listening section..."
              />
              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-sm btn-ghost" style={{ color: '#6366F1' }} onClick={() => setIsAIModalOpen(true)}>
                  Generate with AI
                </button>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#1E293B' }}>Question Groups</h3>
              <button type="button" className="btn-manage-add" onClick={addQuestionGroup} style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}>
                + Add Group
              </button>
            </div>

            {form.question_groups.length === 0 ? (
              <div className="manage-card" style={{ textAlign: 'center', color: '#64748B', borderStyle: 'dashed' }}>
                <p>No question groups yet.</p>
              </div>
            ) : (
              form.question_groups.map((group, gi) => (
                <QuestionGroup
                  key={`group-${gi}`}
                  group={group}
                  gi={gi}
                  totalGroups={form.question_groups.length}
                  isGroupCollapsed={collapsedGroups.has(gi)}
                  collapsedQuestions={collapsedQuestions}
                  questionTypeOptions={SECTION_QUESTION_TYPE_OPTIONS}
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
                  handleBoldShortcut={(event, value, callback) => handleBoldShortcut(event, value, callback)}
                />
              ))
            )}
          </div>
        </div>

        <div className="manage-sidebar-column">
          <div className="manage-card">
            <h3>Metadata</h3>
            <div className="metadata-list">
              <div className="meta-item">
                <span className="meta-label">Created</span>
                <span className="meta-value">
                  {form.createdAt
                    ? new Date(form.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Status</span>
                <span className={`meta-badge ${form.isActive ? 'badge-active' : 'badge-draft'}`}>{form.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="meta-item" style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Total Questions</span>
                <span className="meta-value" style={{ color: '#0EA5E9', fontSize: '1.2rem' }}>{totalQuestions}</span>
              </div>
              <div className="meta-item" style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Question Groups</span>
                <span className="meta-value" style={{ fontSize: '1.2rem' }}>{form.question_groups.length}</span>
              </div>
            </div>
          </div>

          <div className="manage-card tips-card" style={{ background: 'linear-gradient(135deg, #ECFEFF 0%, #E0F2FE 100%)' }}>
            <h3 style={{ color: '#0284C7' }}>Tips</h3>
            <ul className="tips-list">
              <li>Use clean audio with minimal background noise.</li>
              <li>Match difficulty to IELTS listening bands.</li>
              <li>Keep instructions short and explicit.</li>
              <li>Provide clear answer variants for spelling-sensitive items.</li>
              <li>Validate numbering flow before publishing.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
