import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import './Manage.css';

function speakingToForm(speaking) {
  if (!speaking) {
    return {
      _id: '',
      title: '',
      part: '1',
      prompt: '',
      sub_questions: [],
      keywords: [],
      sample_highlights: '',
      isActive: true,
      aiProvider: 'openai',
      aiModel: 'tts-1',
      aiVoice: 'alloy',
      generatedAudioUrl: '',
      createdAt: null,
    };
  }

  return {
    _id: speaking._id || '',
    title: speaking.title || '',
    part: String(speaking.part || '1'),
    prompt: speaking.prompt || '',
    sub_questions: Array.isArray(speaking.sub_questions) ? speaking.sub_questions : [],
    keywords: Array.isArray(speaking.keywords) ? speaking.keywords : [],
    sample_highlights: speaking.sample_highlights || '',
    isActive: speaking.is_active ?? true,
    aiProvider: speaking.read_aloud?.provider || 'openai',
    aiModel: speaking.read_aloud?.model || 'tts-1',
    aiVoice: speaking.read_aloud?.voice || 'alloy',
    generatedAudioUrl: speaking.read_aloud?.prompt?.url || '',
    createdAt: speaking.created_at || speaking.createdAt || null,
  };
}

export default function AddSpeaking({ editIdOverride = null, embedded = false, onSaved = null, onCancel = null }) {
  const { id: routeEditId } = useParams();
  const normalizedRouteEditId = routeEditId === 'new' ? null : routeEditId;
  const editId = editIdOverride ?? normalizedRouteEditId;
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [form, setForm] = useState(speakingToForm(null));
  const [keywordInput, setKeywordInput] = useState('');
  const [newSubQuestion, setNewSubQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (editId) {
          const response = await api.getSpeakingById(editId);
          setForm(speakingToForm(response));
        } else {
          setForm({
            ...speakingToForm(null),
            _id: `speaking-${Date.now()}`,
          });
        }
      } catch (loadErr) {
        setLoadError(loadErr.message);
        showNotification(`Error loading speaking topic: ${loadErr.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [editId, showNotification]);

  const metadataDate = useMemo(() => {
    if (!form.createdAt) {
      return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return new Date(form.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [form.createdAt]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addSubQuestion = () => {
    if (!newSubQuestion.trim()) return;
    setForm((prev) => ({ ...prev, sub_questions: [...prev.sub_questions, newSubQuestion.trim()] }));
    setNewSubQuestion('');
  };

  const removeSubQuestion = (index) => {
    setForm((prev) => ({ ...prev, sub_questions: prev.sub_questions.filter((_, idx) => idx !== index) }));
  };

  const addKeyword = () => {
    const value = keywordInput.trim();
    if (!value) return;
    if (form.keywords.includes(value)) {
      setKeywordInput('');
      return;
    }
    setForm((prev) => ({ ...prev, keywords: [...prev.keywords, value] }));
    setKeywordInput('');
  };

  const removeKeyword = (index) => {
    setForm((prev) => ({ ...prev, keywords: prev.keywords.filter((_, idx) => idx !== index) }));
  };

  const handleGenerateAudio = () => {
    if (!form.prompt.trim()) {
      showNotification('Please add a prompt first.', 'warning');
      return;
    }
    const slug = form._id || `speaking-${Date.now()}`;
    const pseudoUrl = `https://audio-preview.local/${encodeURIComponent(slug)}-${Date.now()}.mp3`;
    updateForm('generatedAudioUrl', pseudoUrl);
    showNotification('Audio preview generated (mock URL).', 'success');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!form._id.trim() || !form.title.trim() || !form.prompt.trim()) {
      showNotification('ID, title, and prompt are required.', 'error');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        part: Number(form.part),
        prompt: form.prompt.trim(),
        sub_questions: form.sub_questions.filter(Boolean),
        keywords: form.keywords.filter(Boolean),
        sample_highlights: form.sample_highlights?.trim() || '',
        is_active: form.isActive,
        read_aloud: {
          provider: form.aiProvider || null,
          model: form.aiModel || null,
          voice: form.aiVoice || null,
          prompt: form.generatedAudioUrl
            ? { url: form.generatedAudioUrl }
            : undefined,
        },
      };

      if (editId) {
        await api.updateSpeaking(editId, payload);
        showNotification('Speaking topic updated.', 'success');
      } else {
        await api.createSpeaking(payload);
        showNotification('Speaking topic created.', 'success');
        if (!editIdOverride) {
          navigate(`/manage/speaking/${form._id}`);
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

  const handleSaveDraft = () => {
    showNotification('Draft saved.', 'success');
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
              else navigate('/manage/speaking');
            }}
            title="Close editor"
          >
            <X size={18} />
          </button>
          <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{editId ? 'Edit Speaking Topic' : 'Create Speaking Topic'}</h1>
          <p className="muted" style={{ marginTop: '0.5rem' }}>IELTS speaking editor with follow-up questions and AI voice settings.</p>
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
            {submitLoading ? 'Saving...' : 'Save Topic'}
          </button>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="manage-layout-columns">
        <div className="manage-main">
          <div className="manage-card" style={{ borderLeft: '4px solid #F59E0B' }}>
            <h3>Basic Information</h3>

            <div className="manage-input-group">
              <label className="manage-input-label">Speaking Topic ID</label>
              <input
                className="manage-input-field"
                value={form._id}
                onChange={(event) => updateForm('_id', event.target.value)}
                readOnly={!!editId}
                placeholder="e.g., SPEAK_P2_001"
              />
            </div>

            <div className="manage-input-group">
              <label className="manage-input-label">Title</label>
              <input
                className="manage-input-field"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                placeholder="Topic title"
              />
            </div>

            <div className="manage-input-group" style={{ marginBottom: 0 }}>
              <label className="manage-input-label">Speaking Part</label>
              <select className="manage-input-field" value={form.part} onChange={(event) => updateForm('part', event.target.value)}>
                <option value="1">Part 1 - Introduction & Interview</option>
                <option value="2">Part 2 - Long Turn (Cue Card)</option>
                <option value="3">Part 3 - Discussion</option>
              </select>
            </div>
          </div>

          <div className="manage-card">
            <h3>Main Prompt</h3>
            <div className="manage-input-group" style={{ marginBottom: 0 }}>
              <label className="manage-input-label">{form.part === '2' ? 'Cue Card' : 'Main Question'}</label>
              <textarea
                className="manage-input-field"
                value={form.prompt}
                onChange={(event) => updateForm('prompt', event.target.value)}
                rows={8}
                placeholder={form.part === '2'
                  ? 'Describe a memorable journey you have made...'
                  : 'What kind of music do you like to listen to?'}
              />
            </div>
          </div>

          <div className="manage-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ marginBottom: 0 }}>Follow-up Questions</h3>
              <button type="button" className="btn btn-sm" style={{ background: '#FEF3C7', color: '#B45309' }} onClick={addSubQuestion}>
                + Add Question
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
              <input
                className="manage-input-field"
                value={newSubQuestion}
                onChange={(event) => setNewSubQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addSubQuestion();
                  }
                }}
                placeholder="Enter follow-up question"
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={addSubQuestion}>Add</button>
            </div>

            {form.sub_questions.length === 0 ? (
              <p className="muted">No follow-up questions yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {form.sub_questions.map((question, index) => (
                  <div key={`sq-${index}`} style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                    <span style={{ minWidth: 18, fontWeight: 700, color: '#F59E0B' }}>{index + 1}</span>
                    <textarea
                      className="manage-input-field"
                      value={question}
                      onChange={(event) => {
                        const next = [...form.sub_questions];
                        next[index] = event.target.value;
                        updateForm('sub_questions', next);
                      }}
                      rows={2}
                    />
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#EF4444' }} onClick={() => removeSubQuestion(index)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="manage-card">
            <h3>AI Audio Settings</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Provider</label>
                <select className="manage-input-field" value={form.aiProvider} onChange={(event) => updateForm('aiProvider', event.target.value)}>
                  <option value="openai">OpenAI</option>
                  <option value="elevenlabs">ElevenLabs</option>
                  <option value="google">Google Cloud</option>
                  <option value="aws">AWS Polly</option>
                </select>
              </div>
              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Model</label>
                <input className="manage-input-field" value={form.aiModel} onChange={(event) => updateForm('aiModel', event.target.value)} />
              </div>
              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Voice</label>
                <input className="manage-input-field" value={form.aiVoice} onChange={(event) => updateForm('aiVoice', event.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button type="button" className="btn-manage-add" onClick={handleGenerateAudio}>
                Generate Audio Preview
              </button>
            </div>

            {form.generatedAudioUrl && (
              <div style={{ marginTop: '0.75rem', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '0.7rem', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#9A3412', fontWeight: 600 }}>Generated Audio URL</div>
                <div style={{ marginTop: '0.35rem', wordBreak: 'break-all', fontSize: '0.85rem' }}>{form.generatedAudioUrl}</div>
              </div>
            )}
          </div>

          <div className="manage-card">
            <h3>Keywords & Sample Highlights</h3>

            <div className="manage-input-group">
              <label className="manage-input-label">Keywords</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="manage-input-field"
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="Type keyword and press Enter"
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={addKeyword}>Add</button>
              </div>

              {form.keywords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.65rem' }}>
                  {form.keywords.map((keyword, index) => (
                    <span
                      key={`kw-${index}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: '#FFEDD5',
                        color: '#C2410C',
                        borderRadius: '999px',
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      {keyword}
                      <button type="button" onClick={() => removeKeyword(index)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#9A3412' }}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="manage-input-group" style={{ marginBottom: 0 }}>
              <label className="manage-input-label">Sample Highlights</label>
              <textarea
                className="manage-input-field"
                value={form.sample_highlights}
                onChange={(event) => updateForm('sample_highlights', event.target.value)}
                rows={6}
                placeholder="Provide key points to cover..."
              />
            </div>
          </div>
        </div>

        <div className="manage-sidebar-column">
          <div className="manage-card">
            <h3>Metadata</h3>
            <div className="metadata-list">
              <div className="meta-item">
                <span className="meta-label">Created</span>
                <span className="meta-value">{metadataDate}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Status</span>
                <span className={`meta-badge ${form.isActive ? 'badge-active' : 'badge-draft'}`}>{form.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="meta-item" style={{ background: '#FFF7ED', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Speaking Part</span>
                <span className="meta-value" style={{ color: '#D97706', fontSize: '1.15rem' }}>Part {form.part}</span>
              </div>
              <div className="meta-item" style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Follow-up Questions</span>
                <span className="meta-value">{form.sub_questions.length}</span>
              </div>
              <div className="meta-item" style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Keywords</span>
                <span className="meta-value">{form.keywords.length}</span>
              </div>
            </div>
          </div>

          <div className="manage-card tips-card" style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)' }}>
            <h3 style={{ color: '#C2410C' }}>Tips</h3>
            <ul className="tips-list">
              <li>Part 1 should stay personal and short-answer friendly.</li>
              <li>Part 2 prompts should include clear cue-card bullets.</li>
              <li>Part 3 should move into abstract discussion and reasoning.</li>
              <li>Define keywords to guide feedback consistency.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
