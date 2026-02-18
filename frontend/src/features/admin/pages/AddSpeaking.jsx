import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import './Manage.css';
import { useNotification } from '@/shared/context/NotificationContext';

export default function AddSpeaking() {
  const { id: editId } = useParams();
  const { showNotification } = useNotification();
  const [speakings, setSpeakings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false); // Define success state
  const [existingSearch, setExistingSearch] = useState('');

  const [form, setForm] = useState({
    _id: '',
    title: '',
    part: 1,
    prompt: '',
    sub_questions: [],
    is_active: true
  });

  const [newSubQuestion, setNewSubQuestion] = useState('');

  useEffect(() => {
    setLoading(true);
    if (editId) {
      setLoadError(null);
      Promise.all([
        api.getSpeakings(),
        api.getSpeakingById(editId),
      ])
        .then(([listRes, itemRes]) => {
          setSpeakings(listRes.data || []);
          setForm({
            _id: itemRes._id || '',
            title: itemRes.title || '',
            part: itemRes.part || 1,
            prompt: itemRes.prompt || '',
            sub_questions: itemRes.sub_questions || [],
            is_active: itemRes.is_active !== undefined ? itemRes.is_active : true
          });
        })
        .catch((err) => {
          setLoadError(err.message);
          showNotification('Lỗi tải chủ đề Speaking: ' + err.message, 'error');
        })
        .finally(() => setLoading(false));
    } else {
      api.getSpeakings()
        .then((res) => {
          setSpeakings(res.data || []);
          setForm({
            _id: `speaking-${Date.now()}`,
            title: '',
            part: 1,
            prompt: '',
            sub_questions: [],
            is_active: true
          });
        })
        .catch(() => { })
        .finally(() => setLoading(false));
    }
  }, [editId]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addSubQuestion = () => {
    if (!newSubQuestion.trim()) return;
    setForm(prev => ({
      ...prev,
      sub_questions: [...prev.sub_questions, newSubQuestion.trim()]
    }));
    setNewSubQuestion('');
  };

  const removeSubQuestion = (index) => {
    setForm(prev => ({
      ...prev,
      sub_questions: prev.sub_questions.filter((_, i) => i !== index)
    }));
  };

  const [selectedTopic, setSelectedTopic] = useState('');

  const matchSearch = (item, query) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item._id || '').toLowerCase().includes(q)
    );
  };

  const filteredSpeakings = speakings.filter((s) => {
    const matchesSearch = matchSearch(s, existingSearch);
    const matchesTopic = selectedTopic ? s.title === selectedTopic : true;
    return matchesSearch && matchesTopic;
  });

  // Extract unique topics for filter
  const uniqueTopics = [...new Set(speakings.map(s => s.title))].sort();

  // Group by topic
  const groupedSpeakings = filteredSpeakings.reduce((groups, item) => {
      const topic = item.title;
      if (!groups[topic]) {
          groups[topic] = [];
      }
      groups[topic].push(item);
      return groups;
  }, {});
  
  // Sort questions within groups by Part
  Object.keys(groupedSpeakings).forEach(topic => {
      groupedSpeakings[topic].sort((a, b) => a.part - b.part);
  });

  const handleDeleteSpeaking = async (speakingId) => {
    if (!window.confirm('Delete this speaking topic? This cannot be undone.')) return;
    try {
      await api.deleteSpeaking(speakingId);
      showNotification('Topic deleted successfully.', 'success');
      const res = await api.getSpeakings();
      setSpeakings(res.data || []);
    } catch (err) {
      setError(err.message);
      showNotification('Error deleting topic: ' + err.message, 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        sub_questions: form.sub_questions,
        is_active: form.is_active
      };

      if (editId) {
        await api.updateSpeaking(editId, payload);
        showNotification('Topic updated successfully.', 'success');
      } else {
        await api.createSpeaking(payload);
        showNotification('Topic created successfully.', 'success');
        setForm({
          _id: `speaking-${Date.now()}`,
          title: '',
          part: 1,
          prompt: '',
          sub_questions: [],
          is_active: true
        });
      }

      // Refresh list
      const res = await api.getSpeakings();
      setSpeakings(res.data || []);

    } catch (err) {
      setError(err.message);
      showNotification(err.message, 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;
  if (editId && loadError) return <div className="manage-section"><p className="form-error">{loadError}</p><Link to="/manage/speaking">Back to list</Link></div>;

  return (
    <div className="manage-container">
      <h1>{editId ? 'Sửa chủ đề Speaking' : 'Thêm chủ đề Speaking'}</h1>
      {error && <p className="form-error">{error}</p>}


      <form onSubmit={handleSubmit} className="manage-form">
        <div className="form-row">
          <label>Mã chủ đề (ID) *</label>
          <input
            value={form._id}
            onChange={(e) => updateForm('_id', e.target.value)}
            placeholder="e.g. speaking-1"
            required
            readOnly={!!editId}
          />
        </div>

        <div className="form-row">
          <label>Phần thi (Part) *</label>
          <select
            value={form.part}
            onChange={(e) => updateForm('part', e.target.value)}
          >
            <option value={1}>Part 1</option>
            <option value={2}>Part 2</option>
            <option value={3}>Part 3</option>
          </select>
        </div>

        <div className="form-row">
          <label>Tiêu đề (Topic Title) *</label>
          <input
            value={form.title}
            onChange={(e) => updateForm('title', e.target.value)}
            placeholder="e.g. Hometown & Background"
            required
          />
        </div>

        <div className="form-row">
          <label>Câu hỏi chính / Cue Card (Prompt) *</label>
          <textarea
            value={form.prompt}
            onChange={(e) => updateForm('prompt', e.target.value)}
            placeholder="Nhập câu hỏi chính hoặc nội dung Cue Card..."
            rows={4}
            required
          />
        </div>

        <div className="form-row">
          <label>Câu hỏi phụ (Sub-questions)</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              value={newSubQuestion}
              onChange={(e) => setNewSubQuestion(e.target.value)}
              placeholder="Nhập câu hỏi phụ..."
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSubQuestion();
                }
              }}
            />
            <button type="button" onClick={addSubQuestion} className="btn-secondary">Thêm</button>
          </div>

          {form.sub_questions.length > 0 && (
            <ul className="vocab-list">
              {form.sub_questions.map((q, i) => (
                <li key={i} className="vocab-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{q}</span>
                  <button type="button" onClick={() => removeSubQuestion(i)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="form-row">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => updateForm('is_active', e.target.checked)}
              style={{ width: 'auto' }}
            />
            Kích hoạt (Hiển thị cho học viên)
          </label>
        </div>

        <div className="form-actions" style={{ marginTop: '2rem' }}>
          <button type="submit" className="btn-manage-add" disabled={submitLoading} style={{ width: '100%', justifyContent: 'center', fontSize: '1.1rem', padding: '1.25rem' }}>
            {submitLoading ? (editId ? 'Đang lưu…' : 'Đang tạo…') : (editId ? 'Cập nhật chủ đề' : 'Tạo chủ đề mới')}
          </button>
          {editId && <Link to="/manage/speaking" className="btn btn-ghost" style={{ marginTop: '1rem', width: '100%', textAlign: 'center' }}>Hủy bỏ</Link>}
        </div>
      </form>

      <div className="search-container" style={{ marginTop: '4rem', paddingTop: '3rem', borderTop: '2px solid #EEF2FF' }}>
        <h3 style={{ color: '#6366F1' }}>Danh sách chủ đề Speaking hiện có</h3>
        {!editId && (
          <>
            <div className="search-box" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input
                type="search"
                value={existingSearch}
                onChange={(e) => setExistingSearch(e.target.value)}
                placeholder="Tìm kiếm theo tiêu đề hoặc ID..."
                className="test-search-input"
                style={{ flex: 2 }}
              />
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="test-search-input"
                style={{ flex: 1, cursor: 'pointer' }}
              >
                <option value="">Tất cả chủ đề</option>
                {uniqueTopics.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>
            </div>
            {existingSearch.trim() && (
              <p className="search-hint">
                Đang hiện {filteredSpeakings.length} trên {speakings.length} bài
              </p>
            )}
            
            <div className="manage-list">
              {Object.entries(groupedSpeakings).length === 0 ? (
                <p className="muted">Chưa có chủ đề nào.</p>
              ) : (
                Object.entries(groupedSpeakings).map(([topic, items]) => (
                  <div key={topic} className="question-group-block">
                    <div className="group-header" style={{ cursor: 'default' }}>
                      <span className="group-title">{topic}</span>
                      <span className="muted" style={{ fontSize: '0.85rem' }}>{items.length} câu hỏi</span>
                    </div>
                    <div className="group-content">
                        {items.map((s) => (
                          <div key={s._id} className="list-item" style={{ marginBottom: '0.75rem' }}>
                            <div className="item-info">
                              <span className="item-title">Part {s.part}</span>
                              <span className="item-meta">ID: {s._id} {s.is_active ? '' : '• (Inactive)'}</span>
                              <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
                                  {s.prompt}
                              </div>
                            </div>
                            <div className="item-actions">
                              <Link to={`/manage/speaking/${s._id}`} className="btn btn-ghost btn-sm">Sửa</Link>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteSpeaking(s._id)} style={{ color: '#ef4444' }}>Xóa</button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
