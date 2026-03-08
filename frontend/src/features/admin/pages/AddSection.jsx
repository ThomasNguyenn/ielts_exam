import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import AIContentGeneratorModal from '@/shared/components/AIContentGeneratorModal';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import QuestionGroup from './QuestionGroup';
import { PLACEHOLDER_FROM_PASSAGE_CONTENT_TYPES, SECTION_QUESTION_TYPE_OPTIONS } from './questionGroupConfig';
import { buildQuestionsFromPlaceholders, parseCorrectAnswersRaw } from './manageQuestionInputUtils';
import { MoreVertical, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const SECTION_AUDIO_MAX_BYTES = 50 * 1024 * 1024;
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

function parseUseOnceFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }
  return false;
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
    group_layout: 'radio',
    required_count: '',
    use_once: false,
    instructions: '',
    text: '',
    image_url: '',
    steps: [],
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
      transcript: '',
      audio_url: '',
      audio_storage_key: '',
      source: '',
      isActive: true,
      isSinglePart: false,
      question_groups: [emptyQuestionGroup()],
    };
  }

  const groups = Array.isArray(section.question_groups) && section.question_groups.length
    ? section.question_groups.map((group) => {
      const normalizedType = canonicalizeQuestionType(group.type);
      return {
        type: normalizedType,
        group_layout: normalizeGroupLayoutForType(normalizedType, group.group_layout),
        required_count: group.required_count ?? '',
        use_once: parseUseOnceFlag(group.use_once),
        instructions: group.instructions || '',
        text: group.text || '',
        image_url: (() => {
          const explicitImageUrl = String(group.image_url || '').trim();
          if (explicitImageUrl) return explicitImageUrl;
          const textValue = String(group.text || '').trim();
          if (isImageQuestionType(normalizedType) && isLikelyAbsoluteUrl(textValue)) return textValue;
          return '';
        })(),
        steps: (() => {
          if (Array.isArray(group.steps) && group.steps.length) {
            return group.steps.map((step) => String(step || '')).filter((step) => step.trim().length > 0);
          }
          if (isFlowOrPlanType(group.type) && String(group.text || '').trim()) {
            return [String(group.text || '').trim()];
          }
          return [];
        })(),
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
      };
    })
    : [emptyQuestionGroup()];

  return {
    _id: section._id || '',
    title: section.title || '',
    content: section.content || '',
    transcript: section.transcript || '',
    audio_url: section.audio_url || '',
    audio_storage_key: section.audio_storage_key || '',
    source: section.source || '',
    isActive: section.is_active ?? true,
    isSinglePart: section.isSinglePart ?? false,
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
    transcript: '',
    audio_url: '',
    audio_storage_key: '',
    source: '',
    isActive: true,
    isSinglePart: false,
    question_groups: [emptyQuestionGroup()],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [audioUploadLoading, setAudioUploadLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [collapsedQuestions, setCollapsedQuestions] = useState(new Set());
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDanger: false,
  });
  const audioFileInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (editId) {
          const response = await api.getSectionById(editId);
          const nextForm = sectionToForm(response.data);
          setForm(nextForm);
          setCollapsedGroups(
            nextForm.isActive
              ? new Set(nextForm.question_groups.map((_, index) => index))
              : new Set(),
          );
        } else {
          setForm({
            _id: `section-${Date.now()}`,
            title: '',
            content: '',
            transcript: '',
            audio_url: '',
            audio_storage_key: '',
            source: '',
            isActive: true,
            isSinglePart: false,
            question_groups: [emptyQuestionGroup()],
          });
          setCollapsedGroups(new Set());
        }
      } catch (loadErr) {
        setLoadError(loadErr.message);
        showNotification(`Error loading section: ${loadErr.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [editId]);

  const totalQuestions = useMemo(
    () => form.question_groups.reduce((sum, group) => sum + (group.questions?.length || 0), 0),
    [form.question_groups]
  );

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleAudioUrlChange = (event) => {
    const nextAudioUrl = event.target.value;
    setForm((prev) => {
      const previousAudioUrl = String(prev.audio_url || '').trim();
      const shouldClearStorageKey = Boolean(prev.audio_storage_key) && nextAudioUrl.trim() !== previousAudioUrl;
      return {
        ...prev,
        audio_url: nextAudioUrl,
        audio_storage_key: shouldClearStorageKey ? '' : prev.audio_storage_key,
      };
    });
  };

  const openAudioUploadPicker = () => {
    audioFileInputRef.current?.click();
  };

  const handleAudioFileSelected = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    const resetInput = () => {
      if (event.target) event.target.value = '';
    };

    if (!String(file.type || '').toLowerCase().startsWith('audio/')) {
      showNotification('Only audio files are allowed.', 'error');
      resetInput();
      return;
    }

    if (file.size > SECTION_AUDIO_MAX_BYTES) {
      showNotification('Audio file must be 50MB or smaller.', 'error');
      resetInput();
      return;
    }

    setAudioUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('audio', file);
      if (form._id?.trim()) {
        formData.append('section_id', form._id.trim());
      }

      const response = await api.uploadSectionAudio(formData);
      const uploadedUrl = response?.data?.url || '';
      const uploadedKey = response?.data?.key || '';

      if (!uploadedUrl || !uploadedKey) {
        throw new Error('Upload succeeded but missing url/key.');
      }

      setForm((prev) => ({
        ...prev,
        audio_url: uploadedUrl,
        audio_storage_key: uploadedKey,
      }));
      showNotification('Audio uploaded successfully.', 'success');
    } catch (uploadError) {
      showNotification(uploadError.message || 'Failed to upload audio.', 'error');
    } finally {
      setAudioUploadLoading(false);
      resetInput();
    }
  };

  const uploadGroupImage = async (groupIndex, file) => {
    if (!String(file?.type || '').toLowerCase().startsWith('image/')) {
      showNotification('Only image files are allowed for map/diagram upload.', 'error');
      return;
    }

    if (file.size > MAX_DIAGRAM_IMAGE_BYTES) {
      showNotification('Image must be 5MB or smaller.', 'error');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', file);
      if (form._id?.trim()) {
        formData.append('section_id', form._id.trim());
      }
      const response = await api.uploadPassageDiagramImage(formData);
      const uploadedUrl = response?.data?.url || '';
      if (!uploadedUrl) {
        throw new Error('Upload succeeded but url is missing.');
      }
      updateQuestionGroup(groupIndex, 'image_url', uploadedUrl);
      showNotification('Image uploaded successfully.', 'success');
    } catch (uploadError) {
      showNotification(uploadError.message || 'Failed to upload image.', 'error');
    }
  };

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
        index === groupIndex
          ? (() => {
            const nextGroup = { ...group, [key]: value };
            if (key === 'type') {
              nextGroup.group_layout = normalizeGroupLayoutForType(value, nextGroup.group_layout);
            }
            if (key === 'group_layout') {
              nextGroup.group_layout = normalizeGroupLayoutForType(nextGroup.type, value);
            }
            return nextGroup;
          })()
          : group
      )),
    }));
  };

  const updateGroupSteps = (groupIndex, steps = []) => {
    const normalizedSteps = Array.isArray(steps) ? steps.map((step) => String(step ?? '')) : [];
    updateQuestionGroup(groupIndex, 'steps', normalizedSteps);
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
    setConfirmModal({
      isOpen: true,
      title: 'Delete Question Group',
      message: 'Delete this question group?',
      isDanger: true,
      onConfirm: () => {
        setForm((prev) => ({
          ...prev,
          question_groups: prev.question_groups.filter((_, index) => index !== groupIndex),
        }));
      },
    });
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

  const setMultiChoiceCorrectAnswers = (groupIndex, selectedIds = []) => {
    setForm((prev) => ({
      ...prev,
      question_groups: prev.question_groups.map((group, groupIdx) => {
        if (groupIdx !== groupIndex) return group;
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
      question_groups: prev.question_groups.map((group, groupIdx) => {
        if (groupIdx !== groupIndex) return group;

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

  const handleAIGenerated = (generatedData) => {
    const normalized = sectionToForm(generatedData);
    setForm((prev) => ({
      ...prev,
      title: normalized.title || prev.title,
      content: normalized.content || prev.content,
      transcript: normalized.transcript || prev.transcript,
      source: normalized.source || prev.source,
      audio_url: normalized.audio_url || prev.audio_url,
      audio_storage_key: normalized.audio_storage_key || prev.audio_storage_key,
      question_groups: normalized.question_groups.length ? normalized.question_groups : prev.question_groups,
    }));
    showNotification('Section generated successfully.', 'success');
  };

  const handleSaveDraft = async () => {
    await saveSection({ asDraft: true });
  };

  const saveSection = async ({ asDraft = false } = {}) => {
    setError(null);
    if (!form._id.trim() || !form.title.trim() || !form.content.trim()) {
      showNotification('ID, title, and content are required.', 'error');
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
      const normalizedAudioUrl = form.audio_url?.trim() || null;
      const normalizedAudioStorageKey = form.audio_storage_key?.trim() || null;
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        content: form.content.trim(),
        transcript: form.transcript?.trim() || undefined,
        audio_url: normalizedAudioUrl,
        audio_storage_key: normalizedAudioStorageKey,
        source: form.source?.trim() || undefined,
        is_active: asDraft ? false : form.isActive,
         isSinglePart: Boolean(form.isSinglePart),
        question_groups: form.question_groups.map((group) => ({
          type: canonicalizeQuestionType(group.type),
          group_layout: normalizeGroupLayoutForType(group.type, group.group_layout),
          required_count: group.required_count ? Number(group.required_count) : undefined,
          use_once: parseUseOnceFlag(group.use_once),
          instructions: group.instructions || undefined,
          text: group.text || undefined,
          image_url: group.image_url?.trim() || undefined,
          steps: (group.steps || []).map((step) => String(step || '').trim()).filter(Boolean).length
            ? (group.steps || []).map((step) => String(step || '').trim()).filter(Boolean)
            : undefined,
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
        showNotification(asDraft ? 'Draft saved.' : 'Section updated successfully.', 'success');
      } else {
        await api.createSection(payload);
        showNotification(asDraft ? 'Draft saved.' : 'Section created successfully.', 'success');
        if (!editIdOverride) {
          navigate(`/admin/manage/sections/${form._id}`);
        }
      }
      if (!asDraft) {
        setCollapsedGroups(new Set(form.question_groups.map((_, index) => index)));
      }

      if (asDraft) {
        setForm((prev) => ({ ...prev, isActive: false }));
      }
      if (typeof onSaved === 'function') onSaved();
    } catch (submitErr) {
      setError(submitErr.message);
      showNotification(submitErr.message, 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await saveSection({ asDraft: false });
  };

  if (loading) {
    return (
      <div className='min-h-[calc(100vh-70px)] bg-muted/30 p-4 md:p-6'>
        <Card className='mx-auto max-w-7xl border-border/70 shadow-sm'>
          <CardContent className='p-6 text-sm text-muted-foreground'>Loading section...</CardContent>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className='min-h-[calc(100vh-70px)] bg-muted/30 p-4 md:p-6'>
        <Card className='mx-auto max-w-7xl border-border/70 shadow-sm'>
          <CardContent className='p-6 text-sm font-medium text-destructive'>{loadError}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-70px)] bg-muted/30'>
      <AIContentGeneratorModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onGenerated={handleAIGenerated}
        type='section'
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
                  else navigate('/admin/manage/sections');
                }}
              >
                <X className='h-4 w-4' />
              </Button>
              <div className='space-y-1'>
                <CardTitle className='text-2xl tracking-tight'>{editId ? 'Edit Listening Section' : 'Create Listening Section'}</CardTitle>
                <CardDescription>Listening section with question groups and audio.</CardDescription>
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
                {submitLoading ? 'Saving...' : 'Save Section'}
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
                <Label htmlFor='section-single-part'>Standalone Part</Label>
                <Switch id='section-single-part' checked={form.isSinglePart} onCheckedChange={(checked) => updateForm('isSinglePart', checked)} />
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
                  <Label htmlFor='section-id'>Section ID</Label>
                  <Input
                    id='section-id'
                    value={form._id}
                    onChange={(event) => updateForm('_id', event.target.value)}
                    readOnly={Boolean(editId)}
                    placeholder='e.g., LIST_SEC_001'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='section-title'>Title</Label>
                  <Input
                    id='section-title'
                    value={form.title}
                    onChange={(event) => updateForm('title', event.target.value)}
                    placeholder='Enter section title'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='section-source'>Source</Label>
                  <Input
                    id='section-source'
                    value={form.source}
                    onChange={(event) => updateForm('source', event.target.value)}
                    placeholder='e.g., Cambridge IELTS 18'
                  />
                </div>

                <div className='space-y-2'>
                  <Label>Listening Audio</Label>
                  <Input
                    ref={audioFileInputRef}
                    type='file'
                    accept='audio/*'
                    onChange={handleAudioFileSelected}
                    className='hidden'
                  />
                  <div className='flex flex-wrap items-center gap-2'>
                    <Button type='button' variant='outline' onClick={openAudioUploadPicker} disabled={audioUploadLoading}>
                      {audioUploadLoading ? 'Uploading...' : form.audio_url?.trim() ? 'Replace Audio' : 'Upload Audio'}
                    </Button>
                    <span className='text-xs text-muted-foreground'>Max file size: 50MB</span>
                  </div>
                  <Input
                    value={form.audio_url}
                    onChange={handleAudioUrlChange}
                    placeholder='https://example.com/audio.mp3'
                  />
                  <p className='text-xs text-muted-foreground'>Manual URL edit clears storage key to avoid deleting external audio.</p>
                  {form.audio_url?.trim() ? <audio controls src={form.audio_url} className='w-full' /> : null}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='section-content'>Context / Description</Label>
                  <Textarea
                    id='section-content'
                    value={form.content}
                    onChange={(event) => updateForm('content', event.target.value)}
                    onKeyDown={(event) => handleBoldShortcut(event, form.content, (next) => updateForm('content', next))}
                    rows={7}
                    placeholder='Brief context for this listening section...'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='section-transcript'>Transcript (Review Mode only)</Label>
                  <Textarea
                    id='section-transcript'
                    value={form.transcript}
                    onChange={(event) => updateForm('transcript', event.target.value)}
                    rows={10}
                    placeholder='Paste listening transcript for review mode...'
                  />
                </div>

                <div className='flex justify-end'>
                  <Button type='button' variant='outline' onClick={() => setIsAIModalOpen(true)}>Generate with AI</Button>
                </div>
              </CardContent>
            </Card>

            <Card className='border-border/70 shadow-sm'>
              <CardHeader className='flex flex-row items-center justify-between gap-3'>
                <CardTitle>Question Groups</CardTitle>
                <Button type='button' onClick={addQuestionGroup}>+ Add Group</Button>
              </CardHeader>
              <CardContent className='space-y-4'>
                {form.question_groups.length === 0 ? (
                  <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>No question groups yet.</div>
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
                      onSetMultiChoiceCorrectAnswers={setMultiChoiceCorrectAnswers}
                      onSyncMultiChoiceSharedQuestion={syncMultiChoiceSharedQuestion}
                      onUpdateGroupSteps={updateGroupSteps}
                      onUploadDiagramImage={uploadGroupImage}
                      handleBoldShortcut={(event, value, callback) => handleBoldShortcut(event, value, callback)}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
