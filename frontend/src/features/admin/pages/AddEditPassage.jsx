import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import AIContentGeneratorModal from '@/shared/components/AIContentGeneratorModal';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import QuestionGroup from './QuestionGroup';
import { PASSAGE_QUESTION_TYPE_OPTIONS, PLACEHOLDER_FROM_PASSAGE_CONTENT_TYPES } from './questionGroupConfig';
import { buildQuestionsFromPlaceholders, parseCorrectAnswersRaw } from './manageQuestionInputUtils';
import { MoreVertical, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';


const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const MAX_DIAGRAM_IMAGE_BYTES = 5 * 1024 * 1024;

function isFlowOrPlanType(type = '') {
  const normalized = canonicalizeQuestionType(type);
  return normalized === 'flow_chart_completion' || normalized === 'plan_map_diagram';
}

function isImageQuestionType(type = '') {
  const normalized = canonicalizeQuestionType(type);
  return normalized === 'diagram_label_completion' || normalized === 'listening_map';
}

function isLikelyAbsoluteUrl(value = '') {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function normalizeOptionToken(raw = '') {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function dedupeOptionIds(values = []) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const normalized = normalizeOptionToken(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function resolveCanonicalOptionId(options = [], rawToken = '') {
  const normalized = normalizeOptionToken(rawToken);
  if (!normalized) return '';

  for (const option of options || []) {
    const label = normalizeOptionToken(option?.label || option?.id || '');
    if (label && label === normalized) return label;
  }

  for (const option of options || []) {
    const text = normalizeOptionToken(option?.text || '');
    const label = normalizeOptionToken(option?.label || option?.id || '');
    if (text && label && text === normalized) return label;
  }

  return normalized;
}

function getQuestionOptionIds(question = {}, options = []) {
  const fromArray = Array.isArray(question?.correct_answers) ? question.correct_answers : [];
  const fromRaw = parseCorrectAnswersRaw(question?.correct_answers_raw || '');
  const source = fromArray.length ? fromArray : fromRaw;
  const canonical = source.map((token) => resolveCanonicalOptionId(options, token));
  return dedupeOptionIds(canonical);
}

function canonicalizeQuestionType(type = '') {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'matching_info') return 'matching_information';
  if (normalized === 'gap_fill') return 'note_completion';
  return normalized || 'mult_choice';
}

function normalizeGroupLayoutForType(type = '', layout = '') {
  const normalizedType = canonicalizeQuestionType(type);
  if (normalizedType === 'mult_choice') {
    return layout === 'checkbox' ? 'checkbox' : 'radio';
  }
  return layout || 'default';
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
    group_layout: 'radio',
    required_count: '',
    use_once: false,
    instructions: '',
    headings: [],
    options: [],
    text: '',
    image_url: '',
    steps: [],
    questions: [emptyQuestion(1)],
  };
}

function passageToForm(p) {
  if (!p) return { _id: '', title: '', content: '', source: '', isActive: true, isSinglePart: false, question_groups: [emptyQuestionGroup()] };
  const groups = p.question_groups && p.question_groups.length
    ? p.question_groups.map((g) => {
      const normalizedType = canonicalizeQuestionType(g.type);
      return {
        type: normalizedType,
        group_layout: normalizeGroupLayoutForType(normalizedType, g.group_layout),
        required_count: g.required_count ?? '',
        use_once: Boolean(g.use_once),
        instructions: g.instructions || '',
        text: g.text || '',
        image_url: (g.image_url && String(g.image_url).trim())
          ? String(g.image_url).trim()
          : (isImageQuestionType(g.type) && isLikelyAbsoluteUrl(g.text)
            ? String(g.text).trim()
            : ''),
        steps: (() => {
          if (Array.isArray(g.steps) && g.steps.length) {
            return g.steps.map((step) => String(step || '')).filter((step) => step.trim().length > 0);
          }
          if (isFlowOrPlanType(g.type) && String(g.text || '').trim()) {
            return [String(g.text || '').trim()];
          }
          return [];
        })(),
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
      };
    })
    : [emptyQuestionGroup()];
  return {
    _id: p._id || '',
    title: p.title || '',
    content: p.content || '',
    source: p.source || '',
    isActive: p.is_active ?? p.isActive ?? true,
    isSinglePart: p.isSinglePart ?? false,
    createdAt: p.createdAt || p.created_at,
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
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDanger: false,
  });

  // Form State
  const [form, setForm] = useState({
    _id: '',
    title: '',
    content: '',
    source: '',
    isActive: true,
    isSinglePart: false,
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
        .then((res) => {
          const nextForm = passageToForm(res.data);
          setForm(nextForm);
          setCollapsedGroups(
            nextForm.isActive
              ? new Set(nextForm.question_groups.map((_, index) => index))
              : new Set(),
          );
        })
        .catch((err) => {
          setLoadError(err.message);
          showNotification('Error loading passage: ' + err.message, 'error');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setForm({ _id: `passage-${Date.now()}`, title: '', content: '', source: '', isActive: true, question_groups: [emptyQuestionGroup()] });
      setCollapsedGroups(new Set());
    }
  }, [editId]);

  useEffect(() => {
    if (!hideExistingList) {
      api.getPassages({ summary: 1 }).then((res) => setPassages(res.data || [])).catch(() => setPassages([]));
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
        i === groupIndex
          ? (() => {
            const nextGroup = { ...g, [key]: value };
            if (key === 'type') {
              nextGroup.group_layout = normalizeGroupLayoutForType(value, nextGroup.group_layout);
            }
            if (key === 'group_layout') {
              nextGroup.group_layout = normalizeGroupLayoutForType(nextGroup.type, value);
            }
            return nextGroup;
          })()
          : g
      ),
    }));
  };

  const updateGroupSteps = (groupIndex, steps = []) => {
    const normalizedSteps = Array.isArray(steps) ? steps.map((step) => String(step ?? '')) : [];
    updateQuestionGroup(groupIndex, 'steps', normalizedSteps);
  };

  const uploadDiagramImage = async (groupIndex, file) => {
    if (!file) return;
    if (!String(file.type || '').toLowerCase().startsWith('image/')) {
      showNotification('Only image files are allowed for diagram upload.', 'error');
      return;
    }
    if (file.size > MAX_DIAGRAM_IMAGE_BYTES) {
      showNotification('Diagram image must be 5MB or smaller.', 'error');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.uploadPassageDiagramImage(formData);
      const uploadedUrl = response?.data?.url || '';
      if (!uploadedUrl) {
        throw new Error('Upload succeeded but did not return an image URL.');
      }
      updateQuestionGroup(groupIndex, 'image_url', uploadedUrl);
      showNotification('Diagram image uploaded successfully.', 'success');
    } catch (uploadError) {
      showNotification(uploadError.message || 'Failed to upload diagram image.', 'error');
    }
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
    setConfirmModal({
      isOpen: true,
      title: 'Remove Question Group',
      message: 'Are you sure you want to remove this group?',
      isDanger: true,
      onConfirm: () => {
        setForm((prev) => ({
          ...prev,
          question_groups: prev.question_groups.filter((_, i) => i !== groupIndex),
        }));
      },
    });
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

  const setMultiChoiceCorrectAnswers = (groupIndex, selectedIds = []) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, gi) => {
        if (gi !== groupIndex) return group;
        const primaryQuestion = group.questions?.[0] || {};
        const primaryOptions = Array.isArray(primaryQuestion.option) && primaryQuestion.option.length
          ? primaryQuestion.option
          : OPTION_LABELS.map((label) => ({ label, text: '' }));
        const canonicalIds = dedupeOptionIds(
          (selectedIds || []).map((value) => resolveCanonicalOptionId(primaryOptions, value))
        );
        const nextRaw = canonicalIds.join(', ');
        return {
          ...group,
          questions: (group.questions || []).map((question) => ({
            ...question,
            correct_answers_raw: nextRaw,
            correct_answers: canonicalIds.length ? [...canonicalIds] : [''],
          })),
        };
      }),
    }));
  };

  const syncMultiChoiceSharedQuestion = (groupIndex, patch = {}) => {
    if (!patch || typeof patch !== 'object') return;

    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, gi) => {
        if (gi !== groupIndex) return group;

        const normalizedPatch = { ...patch };
        if (Array.isArray(normalizedPatch.option)) {
          normalizedPatch.option = normalizedPatch.option.map((option, optionIndex) => ({
            label: String.fromCharCode(65 + optionIndex),
            text: option?.text || '',
          }));
        }

        return {
          ...group,
          questions: (group.questions || []).map((question) => ({
            ...question,
            ...normalizedPatch,
          })),
        };
      }),
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

    const normalizedType = canonicalizeQuestionType(targetGroup.type);
    const sourceText = PLACEHOLDER_FROM_PASSAGE_CONTENT_TYPES.has(normalizedType)
      ? (form.content || '')
      : isFlowOrPlanType(normalizedType)
        ? (Array.isArray(targetGroup.steps) ? targetGroup.steps.join('\n') : '')
      : (targetGroup.text || '');

    const nextQuestions = buildQuestionsFromPlaceholders({
      rawText: sourceText,
      existingQuestions: targetGroup.questions || [],
      createQuestion: (qNumber) => emptyQuestion(qNumber),
    });

    if (!nextQuestions.length) {
      showNotification(
        isFlowOrPlanType(normalizedType)
          ? 'No placeholders found. Use [1], [2], ... in ListSteps.'
          : 'No placeholders found. Use [1], [2], ... in reference text.',
        'warning',
      );
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
    setConfirmModal({
      isOpen: true,
      title: 'Delete Passage',
      message: 'Delete this passage? This cannot be undone.',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.deletePassage(passageId);
          showNotification('Passage deleted.', 'success');
          const res = await api.getPassages({ summary: 1 });
          setPassages(res.data || []);
        } catch (err) {
          setError(err.message);
          showNotification('Error deleting passage: ' + err.message, 'error');
        }
      },
    });
  };

  const savePassage = async ({ asDraft = false } = {}) => {
    if (!form._id.trim() || !form.title.trim() || !form.content.trim()) {
      showNotification('ID, title and content are required.', 'error');
      return;
    }

    for (let groupIndex = 0; groupIndex < form.question_groups.length; groupIndex += 1) {
      const group = form.question_groups[groupIndex];
      if (canonicalizeQuestionType(group.type) !== 'mult_choice' || group.group_layout !== 'checkbox') continue;

      const parsedRequired = Number(group.required_count);
      const requiredCount = Number.isFinite(parsedRequired) && parsedRequired > 0
        ? parsedRequired
        : Math.max(1, group.questions?.length || 1);
      const primaryQuestion = group.questions?.[0] || {};
      const primaryOptions = Array.isArray(primaryQuestion.option) && primaryQuestion.option.length
        ? primaryQuestion.option
        : OPTION_LABELS.map((label) => ({ label, text: '' }));
      const selectedOptionIds = getQuestionOptionIds(primaryQuestion, primaryOptions);

      if (selectedOptionIds.length !== requiredCount) {
        showNotification(
          `Group ${groupIndex + 1}: multiple-answer requires exactly ${requiredCount} selected option ID(s), currently ${selectedOptionIds.length}.`,
          'error',
        );
        return;
      }
    }

    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        content: form.content.trim(),
        source: form.source.trim() || undefined,
        is_active: asDraft ? false : form.isActive,
        isSinglePart: Boolean(form.isSinglePart),
        question_groups: form.question_groups.map((g) => ({
          type: canonicalizeQuestionType(g.type),
          group_layout: normalizeGroupLayoutForType(g.type, g.group_layout),
          required_count: g.required_count ? Number(g.required_count) : undefined,
          use_once: Boolean(g.use_once),
          instructions: g.instructions || undefined,
          text: g.text || undefined,
          image_url: g.image_url?.trim() || undefined,
          steps: (g.steps || []).map((step) => String(step || '').trim()).filter(Boolean).length
            ? (g.steps || []).map((step) => String(step || '').trim()).filter(Boolean)
            : undefined,
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
        showNotification(asDraft ? 'Draft saved.' : 'Passage updated successfully.', 'success');
      } else {
        await api.createPassage(payload);
        showNotification(asDraft ? 'Draft saved.' : 'Passage created successfully.', 'success');
        if (!editIdOverride) {
          navigate(`/admin/manage/passages/${form._id}`);
        }
      }
      if (!asDraft) {
        setCollapsedGroups(new Set(form.question_groups.map((_, index) => index)));
      }
      if (asDraft) {
        setForm((prev) => ({ ...prev, isActive: false }));
      }
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      setError(err.message);
      showNotification(err.message, 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    await savePassage({ asDraft: true });
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
    await savePassage({ asDraft: false });
  };

  if (editId && loading) {
    return (
      <div className='min-h-[calc(100vh-70px)] bg-muted/30 p-4 md:p-6'>
        <Card className='mx-auto max-w-7xl border-border/70 shadow-sm'>
          <CardContent className='p-6 text-sm text-muted-foreground'>Loading passage...</CardContent>
        </Card>
      </div>
    );
  }

  if (editId && loadError) {
    return (
      <div className='min-h-[calc(100vh-70px)] bg-muted/30 p-4 md:p-6'>
        <Card className='mx-auto max-w-7xl border-border/70 shadow-sm'>
          <CardContent className='space-y-4 p-6'>
            <p className='text-sm font-medium text-destructive'>{loadError}</p>
            <Button type='button' variant='outline' onClick={() => navigate('/admin/manage/passages')}>
              Back to passages
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalQuestions = form.question_groups.reduce((acc, g) => acc + g.questions.length, 0);

  return (
    <div className='min-h-[calc(100vh-70px)] bg-muted/30'>
      <AIContentGeneratorModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onGenerated={handleAIGenerated}
        type='passage'
      />
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        isDanger={confirmModal.isDanger}
      />

      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6'>
        <Card className='border-border/70 shadow-sm'>
          <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div className='flex items-start gap-3'>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={() => {
                  if (typeof onCancel === 'function') onCancel();
                  else navigate('/admin/manage/passages');
                }}
              >
                <X className='h-4 w-4' />
              </Button>
              <div className='space-y-1'>
                <CardTitle className='text-2xl tracking-tight'>{editId ? 'Edit Reading Passage' : 'Create Reading Passage'}</CardTitle>
                <CardDescription>Reading comprehension passage with question groups.</CardDescription>
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2 rounded-md border px-3 py-2'>
                <Switch checked={form.isActive} onCheckedChange={(checked) => updateForm('isActive', checked)} />
                <span className='text-sm'>{form.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <Button type='button' variant='outline' onClick={handleSaveDraft}>Save Draft</Button>
              <Button type='button' variant='outline' size='icon' onClick={() => setIsMetadataOpen(true)} aria-label='Open metadata'>
                <MoreVertical className='h-4 w-4' />
              </Button>
              <Button type='button' onClick={handleSubmit} disabled={submitLoading}>
                {submitLoading ? 'Saving...' : 'Save Passage'}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Dialog open={isMetadataOpen} onOpenChange={setIsMetadataOpen}>
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>Metadata</DialogTitle>
            </DialogHeader>
            <div className='space-y-3'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Created</span>
                <span>{form.createdAt ? new Date(form.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Status</span>
                <Badge variant={form.isActive ? 'default' : 'secondary'}>{form.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div className='flex items-center justify-between'>
                <Label htmlFor='single-part'>Standalone Part</Label>
                <Switch id='single-part' checked={form.isSinglePart} onCheckedChange={(checked) => updateForm('isSinglePart', checked)} />
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Total Questions</span>
                <Badge variant='outline'>{totalQuestions}</Badge>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Question Groups</span>
                <Badge variant='outline'>{form.question_groups.length}</Badge>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {error ? (
          <Card className='border-destructive/30 shadow-sm'>
            <CardContent className='p-4 text-sm font-medium text-destructive'>{error}</CardContent>
          </Card>
        ) : null}

        <div className='grid gap-6 xl:grid-cols-12'>
          <div className='space-y-6 xl:col-span-12'>
            <Card className='border-border/70 shadow-sm'>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='passage-id'>Passage ID</Label>
                  <Input
                    id='passage-id'
                    value={form._id}
                    onChange={(event) => updateForm('_id', event.target.value)}
                    readOnly={Boolean(editId)}
                    placeholder='e.g., READ_AC_001'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='passage-title'>Title</Label>
                  <Input
                    id='passage-title'
                    value={form.title}
                    onChange={(event) => updateForm('title', event.target.value)}
                    placeholder='Enter passage title'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='passage-source'>Source</Label>
                  <Input
                    id='passage-source'
                    value={form.source}
                    onChange={(event) => updateForm('source', event.target.value)}
                    placeholder='e.g., Cambridge IELTS 18'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='passage-content'>Passage Content</Label>
                  <Textarea
                    id='passage-content'
                    value={form.content}
                    onChange={(event) => updateForm('content', event.target.value)}
                    onKeyDown={(event) => handleBoldShortcut(event, form.content, (next) => updateForm('content', next))}
                    rows={12}
                    placeholder='Enter the full reading passage text here...'
                  />
                </div>

                <div className='flex justify-end'>
                  <Button type='button' variant='outline' onClick={() => setIsAIModalOpen(true)}>
                    Generate with AI
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className='border-border/70 shadow-sm'>
              <CardHeader className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                <CardTitle>Question Groups</CardTitle>
                <div className='flex flex-wrap items-center gap-2'>
                  <Button type='button' variant='outline' onClick={handleGenerateQuestionInsights} disabled={isGeneratingInsights}>
                    {isGeneratingInsights ? 'Generating...' : 'Generate Explain + Reference'}
                  </Button>
                  <Button type='button' onClick={addQuestionGroup}>+ Add Group</Button>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                {form.question_groups.length === 0 ? (
                  <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
                    No question groups yet. Click "Add Group" to create the first one.
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
                      onSetMultiChoiceCorrectAnswers={setMultiChoiceCorrectAnswers}
                      onSyncMultiChoiceSharedQuestion={syncMultiChoiceSharedQuestion}
                      onUpdateGroupSteps={updateGroupSteps}
                      onUploadDiagramImage={uploadDiagramImage}
                      showPassageReferenceField={true}
                      handleBoldShortcut={(e, val, cb) => handleBoldShortcut(e, val, cb)}
                    />
                  ))
                )}

                {form.question_groups.length > 0 ? (
                  <Button type='button' className='w-full' onClick={addQuestionGroup}>+ Add Another Group</Button>
                ) : null}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
