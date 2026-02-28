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
      part2_question_title: '',
      part: '1',
      prompt: '',
      cue_card: '',
      sub_questions: [],
      keywords: [],
      sample_highlights: '',
      isActive: true,
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini-tts',
      aiVoice: 'alloy',
      generatedAudioUrl: '',
      createdAt: null,
    };
  }

  const part = String(speaking.part || '1');
  const isPart2 = part === '2';
  const storedTitle = String(speaking.title || '').trim();
  const storedPrompt = String(speaking.prompt || '').trim();
  const storedPart2QuestionTitle = String(speaking.part2_question_title || '').trim();
  const storedCueCard = String(speaking.cue_card || '').trim();

  return {
    _id: speaking._id || '',
    title: storedTitle,
    part2_question_title: isPart2 ? (storedPart2QuestionTitle || storedPrompt) : storedPart2QuestionTitle,
    part,
    prompt: storedPrompt,
    cue_card: storedCueCard,
    sub_questions: Array.isArray(speaking.sub_questions) ? speaking.sub_questions : [],
    keywords: Array.isArray(speaking.keywords) ? speaking.keywords : [],
    sample_highlights: speaking.sample_highlights || '',
    isActive: speaking.is_active ?? true,
    aiProvider: speaking.read_aloud?.provider || 'openai',
    aiModel: speaking.read_aloud?.model || 'gpt-4o-mini-tts',
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
  const [generateAudioLoading, setGenerateAudioLoading] = useState(false);
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
        showNotification(`Lỗi tải bài thi nói: ${loadErr.message}`, 'error');
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

  const handleGenerateAudio = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const sourcePrompt = form.part === '2' ? form.part2_question_title : form.prompt;
    if (!sourcePrompt.trim()) {
      showNotification('Vui long them cau hoi chinh truoc.', 'warning');
      return;
    }

    setGenerateAudioLoading(true);
    try {
      const response = await api.generateSpeakingReadAloud({
        topicId: (form._id || `speaking-${Date.now()}`).trim(),
        prompt: sourcePrompt,
        provider: form.aiProvider || 'openai',
        model: form.aiModel || undefined,
        voice: form.aiVoice || undefined,
      });

      const payload = response?.data || response;
      const audioUrl = String(payload?.url || '').trim();
      if (!audioUrl) {
        throw new Error('Generate audio succeeded but URL is missing');
      }

      updateForm('generatedAudioUrl', audioUrl);
      showNotification('Da tao file mp3 cho cau hoi thanh cong.', 'success');
    } catch (generateErr) {
      console.error('Generate speaking read-aloud failed:', generateErr);
      showNotification(generateErr.message || 'Khong the tao am thanh. Vui long thu lai.', 'error');
    } finally {
      setGenerateAudioLoading(false);
    }
  };

  const saveSpeaking = async ({ asDraft = false } = {}) => {
    setError(null);

    const normalizedPart = Number(form.part);
    const normalizedTitle = form.title.trim();
    const normalizedPart2QuestionTitle = normalizedPart === 2
      ? String(form.part2_question_title || '').trim()
      : '';
    const normalizedPrompt = normalizedPart === 2
      ? normalizedPart2QuestionTitle
      : form.prompt.trim();
    const normalizedCueCard = form.cue_card?.trim() || '';

    if (!form._id.trim() || !normalizedTitle || !normalizedPrompt || (normalizedPart === 2 && !normalizedPart2QuestionTitle)) {
      showNotification('ID, topic category, and question title are required.', 'error');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: normalizedTitle,
        part: normalizedPart,
        prompt: normalizedPrompt,
        part2_question_title: normalizedPart2QuestionTitle,
        cue_card: normalizedCueCard,
        sub_questions: form.sub_questions.filter(Boolean),
        keywords: form.keywords.filter(Boolean),
        sample_highlights: form.sample_highlights?.trim() || '',
        is_active: asDraft ? false : form.isActive,
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
        showNotification('Đã cập nhật bài thi nói.', 'success');
      } else {
        await api.createSpeaking(payload);
        showNotification('Đã tạo bài thi nói mới.', 'success');
        if (!editIdOverride) {
          navigate(`/manage/speaking/${form._id}`);
        }
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
    await saveSpeaking({ asDraft: false });
  };

  const handleSaveDraft = async () => {
    await saveSpeaking({ asDraft: true });
  };

  if (loading) return <div className="manage-container"><p className="muted">Đang tải...</p></div>;
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
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{editId ? 'Chỉnh sửa Bài thi Nói' : 'Tạo Bài thi Nói'}</h1>
            <p className="muted" style={{ marginTop: '0.5rem' }}>Trình soạn thảo bài thi IELTS Speaking với câu hỏi theo sau và cài đặt giọng nói AI.</p>
          </div>
        </div>

        <div className="manage-header-actions">
          <label className="status-toggle">
            {form.isActive ? 'Hoạt động' : 'Đã tắt'}
            <div className="switch">
              <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm('isActive', event.target.checked)} />
              <span className="slider"></span>
            </div>
          </label>

          <button type="button" className="btn-ghost" onClick={handleSaveDraft}>Lưu bản nháp</button>

          <button type="button" className="btn-manage-add" onClick={handleSubmit} disabled={submitLoading}>
            {submitLoading ? 'Đang lưu...' : 'Lưu bài thi'}
          </button>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="manage-layout-columns">
        <div className="manage-main">
          <div className="manage-card" style={{ borderLeft: '4px solid #F59E0B' }}>
            <h3>Thông tin Cơ bản</h3>

            <div className="manage-input-group">
              <label className="manage-input-label">ID Bài thi Nói</label>
              <input
                className="manage-input-field"
                value={form._id}
                onChange={(event) => updateForm('_id', event.target.value)}
                readOnly={!!editId}
                placeholder="VD: SPEAK_P2_001"
              />
            </div>

            <div className="manage-input-group">
              <label className="manage-input-label">
                {form.part === '2' ? 'Tiêu đề (Topic Category)' : 'Tiêu đề'}
              </label>
              <input
                className="manage-input-field"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                placeholder={form.part === '2' ? 'Education, Travel, Environment...' : 'Tiêu đề bài thi'}
              />
            </div>

            {form.part === '2' ? (
              <div className="manage-input-group">
                <label className="manage-input-label">Part 2 Question Title</label>
                <input
                  className="manage-input-field"
                  value={form.part2_question_title}
                  onChange={(event) => updateForm('part2_question_title', event.target.value)}
                  placeholder="Describe a teacher who influenced you"
                />
              </div>
            ) : null}

            <div className="manage-input-group" style={{ marginBottom: 0 }}>
              <label className="manage-input-label">Phần thi Nói</label>
              <select className="manage-input-field" value={form.part} onChange={(event) => updateForm('part', event.target.value)}>
                <option value="1">Part 1 - Giới thiệu & Phỏng vấn</option>
                <option value="2">Part 2 - Nói tự do (Cue Card)</option>
                <option value="3">Part 3 - Thảo luận</option>
              </select>
            </div>
          </div>

          <div className="manage-card">
            <h3>{form.part === '2' ? 'Cue Card' : 'Câu hỏi Chính'}</h3>
            <div className="manage-input-group" style={{ marginBottom: 0 }}>
              {form.part === '2' ? (
                <>
                  <label className="manage-input-label">Cue Card Bullets (one point per line)</label>
                  <textarea
                    className="manage-input-field"
                    value={form.cue_card}
                    onChange={(event) => updateForm('cue_card', event.target.value)}
                    rows={8}
                    placeholder={'Describe a time you learned something new\nWhere it happened\nWho taught you\nWhy it was memorable'}
                  />
                </>
              ) : (
                <>
                  <label className="manage-input-label">Câu hỏi Chính</label>
                  <textarea
                    className="manage-input-field"
                    value={form.prompt}
                    onChange={(event) => updateForm('prompt', event.target.value)}
                    rows={8}
                    placeholder="Bạn thích nghe thể loại nhạc nào?"
                  />
                </>
              )}
            </div>
          </div>

          <div className="manage-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ marginBottom: 0 }}>Câu hỏi Tiếp nối</h3>
              <button type="button" className="btn btn-sm" style={{ background: '#FEF3C7', color: '#B45309' }} onClick={addSubQuestion}>
                + Thêm Câu hỏi
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
                placeholder="Nhập câu hỏi tiếp nối"
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={addSubQuestion}>Thêm</button>
            </div>

            {form.sub_questions.length === 0 ? (
              <p className="muted">Chưa có câu hỏi tiếp nối nào.</p>
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
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="manage-card">
            <h3>Cài đặt Âm thanh AI</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Nhà cung cấp</label>
                <select className="manage-input-field" value={form.aiProvider} onChange={(event) => updateForm('aiProvider', event.target.value)}>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Mô hình</label>
                <input className="manage-input-field" value={form.aiModel} onChange={(event) => updateForm('aiModel', event.target.value)} />
              </div>
              <div className="manage-input-group" style={{ marginBottom: 0 }}>
                <label className="manage-input-label">Giọng nói</label>
                <input className="manage-input-field" value={form.aiVoice} onChange={(event) => updateForm('aiVoice', event.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn-manage-add"
                onClick={handleGenerateAudio}
                disabled={generateAudioLoading}
              >
                {generateAudioLoading ? 'Dang tao mp3...' : 'Tao Am thanh Cau hoi'}
              </button>
            </div>

            {form.generatedAudioUrl && (
              <div style={{ marginTop: '0.75rem', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '0.7rem', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#9A3412', fontWeight: 600 }}>Đường dẫn Âm thanh đã tạo</div>
                <div style={{ marginTop: '0.35rem', wordBreak: 'break-all', fontSize: '0.85rem' }}>{form.generatedAudioUrl}</div>
              </div>
            )}
          </div>

          <div className="manage-card">
            <h3>Từ khóa & Gợi ý Câu trả lời</h3>

            <div className="manage-input-group">
              <label className="manage-input-label">Từ khóa</label>
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
                  placeholder="Nhập từ khóa và nhấn Enter"
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={addKeyword}>Thêm</button>
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
              <label className="manage-input-label">Gợi ý Ý chính</label>
              <textarea
                className="manage-input-field"
                value={form.sample_highlights}
                onChange={(event) => updateForm('sample_highlights', event.target.value)}
                rows={6}
                placeholder="Cung cấp các ý chính cần đề cập..."
              />
            </div>
          </div>
        </div>

        <div className="manage-sidebar-column">
          <div className="manage-card">
            <h3>Siêu dữ liệu</h3>
            <div className="metadata-list">
              <div className="meta-item">
                <span className="meta-label">Đã tạo lúc</span>
                <span className="meta-value">{metadataDate}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Trạng thái</span>
                <span className={`meta-badge ${form.isActive ? 'badge-active' : 'badge-draft'}`}>{form.isActive ? 'Hoạt động' : 'Đã tắt'}</span>
              </div>
              <div className="meta-item" style={{ background: '#FFF7ED', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Phần thi Nói</span>
                <span className="meta-value" style={{ color: '#D97706', fontSize: '1.15rem' }}>Part {form.part}</span>
              </div>
              <div className="meta-item" style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Câu hỏi Tiếp nối</span>
                <span className="meta-value">{form.sub_questions.length}</span>
              </div>
              <div className="meta-item" style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.6rem' }}>
                <span className="meta-label">Từ khóa</span>
                <span className="meta-value">{form.keywords.length}</span>
              </div>
            </div>
          </div>

          <div className="manage-card tips-card" style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)' }}>
            <h3 style={{ color: '#C2410C' }}>Mẹo</h3>
            <ul className="tips-list">
              <li>Part 1 nên là các câu hỏi cá nhân và trả lời ngắn gọn.</li>
              <li>Part 2 nên bao gồm các ý chính (bullets) rõ ràng cho cue-card.</li>
              <li>Part 3 nên hướng tới thảo luận trừu tượng và lập luận.</li>
              <li>Định nghĩa từ khóa để hướng dẫn đánh giá nhất quán.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
