import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import LessonEditor from '../components/LessonEditor';
import './Manage.css';

const emptyQuizItem = () => ({
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  explanation: '',
});

const emptyResourceItem = () => ({
  title: '',
  url: '',
  type: 'article',
  description: '',
});

const emptyForm = () => ({
  title: '',
  description: '',
  icon: '📚',
  estimatedMinutes: 10,
  isActive: true,
  videoUrl: '',
  lesson: '',
  keyPointsText: '',
  examplesText: '',
  resources: [emptyResourceItem()],
  checkpointQuiz: [emptyQuizItem()],
});

const splitLines = (text) =>
  String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const moduleToForm = (module) => ({
  title: module?.title || '',
  description: module?.description || '',
  icon: module?.icon || '📚',
  estimatedMinutes: module?.estimatedMinutes || 10,
  isActive: module?.isActive !== false,
  videoUrl: module?.content?.videoUrl || '',
  lesson: module?.content?.lesson || '',
  keyPointsText: (module?.content?.keyPoints || []).join('\n'),
  examplesText: (module?.content?.examples || []).join('\n'),
  resources:
    module?.content?.resources?.length > 0
      ? module.content.resources.map((r) => ({
          title: r.title || '',
          url: r.url || '',
          type: r.type || 'article',
          description: r.description || '',
        }))
      : [emptyResourceItem()],
  checkpointQuiz:
    module?.content?.checkpointQuiz?.length > 0
      ? module.content.checkpointQuiz.map((q) => ({
          question: q.question || '',
          options: Array.isArray(q.options) && q.options.length > 0 ? q.options : ['', '', '', ''],
          correctAnswer: Number.isInteger(q.correctAnswer) ? q.correctAnswer : 0,
          explanation: q.explanation || '',
        }))
      : [emptyQuizItem()],
});

const formToPayload = (form) => ({
  title: form.title.trim(),
  description: form.description.trim(),
  icon: form.icon.trim() || '📚',
  estimatedMinutes: Number(form.estimatedMinutes) || 10,
  isActive: !!form.isActive,
  content: {
    lesson: form.lesson.trim(),
    videoUrl: form.videoUrl.trim(),
    keyPoints: splitLines(form.keyPointsText),
    examples: splitLines(form.examplesText),
    resources: (form.resources || [])
      .map((r) => ({
        title: String(r.title || '').trim(),
        url: String(r.url || '').trim(),
        type: String(r.type || 'article').trim() || 'article',
        description: String(r.description || '').trim(),
      }))
      .filter((r) => r.title && r.url),
    checkpointQuiz: (form.checkpointQuiz || [])
      .map((q) => ({
        question: String(q.question || '').trim(),
        options: (q.options || []).map((opt) => String(opt || '').trim()).filter(Boolean),
        correctAnswer: Number(q.correctAnswer) || 0,
        explanation: String(q.explanation || '').trim(),
      }))
      .filter((q) => q.question && q.options.length >= 2 && q.correctAnswer < q.options.length),
  },
});

export default function AddSkillModules() {
  const { id: editId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [modules, setModules] = useState([]);
  const [orderedActiveModules, setOrderedActiveModules] = useState([]);
  const [dragModuleId, setDragModuleId] = useState(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDanger: false,
  });

  const filteredModules = useMemo(() => {
    if (!search.trim()) return modules;
    const q = search.trim().toLowerCase();
    return modules.filter(
      (module) =>
        String(module.title || '').toLowerCase().includes(q) ||
        String(module.description || '').toLowerCase().includes(q),
    );
  }, [modules, search]);

  const loadModules = async () => {
    const response = await api.getManageSkillModules(true);
    setModules(response.data || []);
  };

  useEffect(() => {
    const nextOrdered = (modules || [])
      .filter((module) => module.isActive)
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    setOrderedActiveModules(nextOrdered);
    setOrderDirty(false);
    setDragModuleId(null);
  }, [modules]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await loadModules();
        if (editId) {
          const response = await api.getManageSkillModuleById(editId);
          setForm(moduleToForm(response.data));
        } else {
          setForm(emptyForm());
        }
      } catch (error) {
        showNotification(error.message || 'Failed to load skill modules', 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [editId]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateResource = (index, key, value) => {
    setForm((prev) => {
      const next = [...prev.resources];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, resources: next };
    });
  };

  const addResource = () => setForm((prev) => ({ ...prev, resources: [...prev.resources, emptyResourceItem()] }));

  const removeResource = (index) => {
    setForm((prev) => ({
      ...prev,
      resources: prev.resources.length > 1 ? prev.resources.filter((_, i) => i !== index) : [emptyResourceItem()],
    }));
  };

  const updateQuiz = (index, key, value) => {
    setForm((prev) => {
      const next = [...prev.checkpointQuiz];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, checkpointQuiz: next };
    });
  };

  const updateQuizOption = (qIndex, optionIndex, value) => {
    setForm((prev) => {
      const quiz = [...prev.checkpointQuiz];
      const options = [...quiz[qIndex].options];
      options[optionIndex] = value;
      quiz[qIndex] = { ...quiz[qIndex], options };
      return { ...prev, checkpointQuiz: quiz };
    });
  };

  const addQuizQuestion = () =>
    setForm((prev) => ({ ...prev, checkpointQuiz: [...prev.checkpointQuiz, emptyQuizItem()] }));

  const removeQuizQuestion = (index) => {
    setForm((prev) => ({
      ...prev,
      checkpointQuiz:
        prev.checkpointQuiz.length > 1
          ? prev.checkpointQuiz.filter((_, i) => i !== index)
          : [emptyQuizItem()],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = formToPayload(form);

    if (!payload.title || !payload.description || !payload.content.lesson) {
      showNotification('Title, description, and lesson are required.', 'warning');
      return;
    }

    setSubmitLoading(true);
    try {
      if (editId) {
        await api.updateSkillModule(editId, payload);
        showNotification('Skill module updated.', 'success');
      } else {
        await api.createSkillModule(payload);
        showNotification('Skill module created.', 'success');
        setForm(emptyForm());
      }
      await loadModules();
    } catch (error) {
      showNotification(error.message || 'Failed to save skill module', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Disable Skill Module',
      message: 'Disable this module? Students will no longer see it in learning flow.',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.deleteSkillModule(id);
          showNotification('Skill module disabled.', 'success');
          await loadModules();
          if (editId === id) navigate('/manage/skill-modules');
        } catch (error) {
          showNotification(error.message || 'Failed to disable module', 'error');
        }
      },
    });
  };

  const handleReorderDrop = (targetModuleId) => {
    if (!dragModuleId || dragModuleId === targetModuleId) return;

    setOrderedActiveModules((prev) => {
      const fromIndex = prev.findIndex((module) => module._id === dragModuleId);
      const toIndex = prev.findIndex((module) => module._id === targetModuleId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setOrderDirty(true);
    setDragModuleId(null);
  };

  const handleSaveReorder = async () => {
    if (!orderDirty || orderedActiveModules.length === 0) return;

    setReorderSaving(true);
    try {
      await api.reorderSkillModules(orderedActiveModules.map((module) => module._id));
      showNotification('Module order updated.', 'success');
      await loadModules();
    } catch (error) {
      showNotification(error.message || 'Failed to reorder modules', 'error');
    } finally {
      setReorderSaving(false);
    }
  };

  if (loading) return <p className="muted">Loading...</p>;

  return (
    <div className="manage-container">
      <h1>{editId ? 'Edit Skill Module' : 'Add Skill Module'}</h1>

      <form onSubmit={handleSubmit} className="manage-form">
        <div className="form-row">
          <label>Module title *</label>
          <input value={form.title} onChange={(e) => updateField('title', e.target.value)} required />
        </div>

        <div className="form-row">
          <label>Description *</label>
          <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} required />
        </div>

        <div className="form-row">
          <label>Lesson content *</label>
          <LessonEditor value={form.lesson} onChange={(html) => updateField('lesson', html)} />
        </div>

        <div className="form-row">
          <label>Video URL (optional)</label>
          <input value={form.videoUrl} onChange={(e) => updateField('videoUrl', e.target.value)} />
        </div>

        <div className="form-row">
          <label>Key points (one line per point)</label>
          <textarea value={form.keyPointsText} onChange={(e) => updateField('keyPointsText', e.target.value)} rows={5} />
        </div>

        <div className="form-row">
          <label>Examples (one line per example)</label>
          <textarea value={form.examplesText} onChange={(e) => updateField('examplesText', e.target.value)} rows={5} />
        </div>

        <div className="form-row">
          <label>Estimated minutes</label>
          <input
            type="number"
            min={1}
            value={form.estimatedMinutes}
            onChange={(e) => updateField('estimatedMinutes', e.target.value)}
          />
        </div>

        <div className="form-row">
          <label>Icon</label>
          <input value={form.icon} onChange={(e) => updateField('icon', e.target.value)} />
        </div>

        <div className="form-row">
          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateField('isActive', e.target.checked)}
              style={{ width: '1.1rem', height: '1.1rem' }}
            />
            Active module
          </label>
        </div>

        <div className="form-section">
          <h4>Learning Resources</h4>
          {form.resources.map((resource, index) => (
            <div key={`resource-${index}`} className="heading-row">
              <input
                className="heading-text"
                placeholder="Resource title"
                value={resource.title}
                onChange={(e) => updateResource(index, 'title', e.target.value)}
              />
              <input
                className="heading-text"
                placeholder="URL"
                value={resource.url}
                onChange={(e) => updateResource(index, 'url', e.target.value)}
              />
              <input
                className="heading-id"
                placeholder="Type"
                value={resource.type}
                onChange={(e) => updateResource(index, 'type', e.target.value)}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeResource(index)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn-manage-add" onClick={addResource}>
            + Add Resource
          </button>
        </div>

        <div className="form-section">
          <h4>Checkpoint Quiz</h4>
          {form.checkpointQuiz.map((quiz, quizIndex) => (
            <div key={`quiz-${quizIndex}`} className="question-group-block">
              <div className="group-content">
                <div className="form-row">
                  <label>Question {quizIndex + 1}</label>
                  <textarea
                    value={quiz.question}
                    onChange={(e) => updateQuiz(quizIndex, 'question', e.target.value)}
                    rows={2}
                  />
                </div>
                {quiz.options.map((option, optionIndex) => (
                  <div key={`option-${quizIndex}-${optionIndex}`} className="form-row">
                    <label>Option {optionIndex + 1}</label>
                    <input
                      value={option}
                      onChange={(e) => updateQuizOption(quizIndex, optionIndex, e.target.value)}
                    />
                  </div>
                ))}
                <div className="form-row">
                  <label>Correct answer index (0-based)</label>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, quiz.options.length - 1)}
                    value={quiz.correctAnswer}
                    onChange={(e) => updateQuiz(quizIndex, 'correctAnswer', Number(e.target.value) || 0)}
                  />
                </div>
                <div className="form-row">
                  <label>Explanation</label>
                  <textarea
                    value={quiz.explanation}
                    onChange={(e) => updateQuiz(quizIndex, 'explanation', e.target.value)}
                    rows={2}
                  />
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeQuizQuestion(quizIndex)}>
                  Remove Question
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn-manage-add" onClick={addQuizQuestion}>
            + Add Quiz Question
          </button>
        </div>

        <div className="form-actions" style={{ marginTop: '1.5rem' }}>
          <button type="submit" className="btn-manage-add" disabled={submitLoading}>
            {submitLoading ? 'Saving...' : editId ? 'Update Skill Module' : 'Create Skill Module'}
          </button>
          {editId && (
            <Link to="/manage/skill-modules" className="btn btn-ghost">
              Cancel
            </Link>
          )}
        </div>
      </form>

      <div className="search-container" style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '2px solid #EEF2FF' }}>
        <h3 style={{ color: '#6366F1' }}>Existing Skill Modules</h3>
        {!editId && (
          <>
            <div className="form-section" style={{ marginBottom: '1.5rem' }}>
              <h4>Reorder Active Modules (Drag and Drop)</h4>
              {orderedActiveModules.length <= 1 ? (
                <p className="muted">Need at least 2 active modules to reorder.</p>
              ) : (
                <>
                  <ul className="sortable-list">
                    {orderedActiveModules.map((module, index) => (
                      <li
                        key={`reorder-${module._id}`}
                        className="sortable-item"
                        draggable
                        onDragStart={() => setDragModuleId(module._id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleReorderDrop(module._id)}
                        onDragEnd={() => setDragModuleId(null)}
                      >
                        <div className="drag-handle" title="Drag to reorder">⋮⋮</div>
                        <div className="sortable-item-content">
                          <span className="sortable-item-title">
                            {index + 1}. {module.icon || '📚'} {module.title}
                          </span>
                          <span className="sortable-item-id">id: {module._id}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="form-actions" style={{ marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn-manage-add"
                      disabled={!orderDirty || reorderSaving}
                      onClick={handleSaveReorder}
                    >
                      {reorderSaving ? 'Saving order...' : 'Save Module Order'}
                    </button>
                    {orderDirty && !reorderSaving && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          const reset = (modules || [])
                            .filter((module) => module.isActive)
                            .slice()
                            .sort((a, b) => (a.order || 0) - (b.order || 0));
                          setOrderedActiveModules(reset);
                          setOrderDirty(false);
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="search-box">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or description..."
                className="test-search-input"
              />
            </div>
            <div className="manage-list" style={{ marginTop: '1rem' }}>
              {filteredModules.length === 0 ? (
                <p className="muted">No skill modules found.</p>
              ) : (
                filteredModules.map((module) => (
                  <div key={module._id} className="list-item">
                    <div className="item-info">
                      <span className="item-title">
                        {module.icon || '📚'} {module.title}
                      </span>
                      <span className="item-meta">
                        {module.isActive ? 'Active' : 'Inactive'} · Module {module.moduleNumber} · {module.estimatedMinutes || 0} mins
                      </span>
                    </div>
                    <div className="item-actions">
                      <Link to={`/manage/skill-modules/${module._id}`} className="btn btn-ghost btn-sm">
                        Edit
                      </Link>
                      {module.isActive && (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDelete(module._id)}>
                          Disable
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        isDanger={confirmModal.isDanger}
      />
    </div>
  );
}
