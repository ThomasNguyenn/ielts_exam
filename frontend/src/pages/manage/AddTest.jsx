import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../../api/client';
import { useNotification } from '../../components/NotificationContext';
import ConfirmationModal from '../../components/ConfirmationModal';
import './Manage.css';

function testToForm(t) {
  if (!t) return { _id: '', title: '', category: '', is_real_test: false, type: 'reading', duration: 60, full_audio: '', reading_passages: [], listening_sections: [], writing_tasks: [] };
  const toId = (x) => (typeof x === 'object' && x && x._id ? x._id : x);
  return {
    _id: t._id || '',
    title: t.title || '',
    category: t.category || 'Uncategorized',
    is_real_test: t.is_real_test || false,
    type: t.type || 'reading',
    duration: t.duration || (t.type === 'reading' ? 60 : t.type === 'listening' ? 35 : 45),
    full_audio: t.full_audio || '',
    reading_passages: (t.reading_passages || []).map(toId),
    listening_sections: (t.listening_sections || []).map(toId),
    writing_tasks: (t.writing_tasks || []).map(toId),
  };
}

const Icons = {
  Tests: () => (
    <svg className="manage-nav-icon" style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
  )
};

function SortableItem({ id, title, subtitle, onRemove, type }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="sortable-item">
      <div className="drag-handle" {...attributes} {...listeners}>
        <span className="drag-icon">⋮⋮</span>
      </div>
      <div className="sortable-item-content">
        <span className="sortable-item-title">{title}</span>
        <code className="sortable-item-id">{subtitle}</code>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(id)}>
        Remove
      </button>
    </li>
  );
}

export default function AddTest() {
  const { id: editId } = useParams();
  const [passages, setPassages] = useState([]);
  const [sections, setSections] = useState([]);
  const [writings, setWritings] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showNotification } = useNotification();
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, isDanger: false });
  const [existingSearch, setExistingSearch] = useState('');

  const [form, setForm] = useState({
    _id: '',
    title: '',
    category: '',
    is_real_test: false,
    type: 'reading',
    duration: 60,
    full_audio: '',
    reading_passages: [],
    listening_sections: [],
    writing_tasks: [],
  });

  const [passageSearch, setPassageSearch] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [writingSearch, setWritingSearch] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setLoading(true);
    if (editId) {
      setLoadError(null);
      Promise.all([
        api.getPassages(),
        api.getSections(),
        api.getWritings(),
        api.getTests(),
        api.getTestById(editId),
      ])
        .then(([pRes, sRes, wRes, tRes, testRes]) => {
          setPassages(pRes.data || []);
          setSections(sRes.data || []);
          setWritings(wRes.data || []);
          setTests(tRes.data || []);
          setForm(testToForm(testRes.data));
        })
        .catch((err) => setLoadError(err.message))
        .finally(() => setLoading(false));
    } else {
      Promise.all([api.getPassages(), api.getSections(), api.getWritings(), api.getTests()])
        .then(([pRes, sRes, wRes, tRes]) => {
          setPassages(pRes.data || []);
          setSections(sRes.data || []);
          setWritings(wRes.data || []);
          setTests(tRes.data || []);
          setForm({ _id: `test-${Date.now()}`, title: '', category: '', is_real_test: false, type: 'reading', duration: 60, full_audio: '', reading_passages: [], listening_sections: [], writing_tasks: [] });
        })
        .catch(() => { })
        .finally(() => setLoading(false));
    }
  }, [editId]);



  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const togglePassage = (id) => {
    setForm((prev) => ({
      ...prev,
      reading_passages: prev.reading_passages.includes(id)
        ? prev.reading_passages.filter((x) => x !== id)
        : [...prev.reading_passages, id],
    }));
  };

  const toggleSection = (id) => {
    setForm((prev) => ({
      ...prev,
      listening_sections: prev.listening_sections.includes(id)
        ? prev.listening_sections.filter((x) => x !== id)
        : [...prev.listening_sections, id],
    }));
  };

  const toggleWriting = (id) => {
    setForm((prev) => ({
      ...prev,
      writing_tasks: prev.writing_tasks.includes(id)
        ? prev.writing_tasks.filter((x) => x !== id)
        : [...prev.writing_tasks, id],
    }));
  };

  const removePassage = (id) => {
    setForm((prev) => ({
      ...prev,
      reading_passages: prev.reading_passages.filter((x) => x !== id),
    }));
  };

  const removeSection = (id) => {
    setForm((prev) => ({
      ...prev,
      listening_sections: prev.listening_sections.filter((x) => x !== id),
    }));
  };

  const removeWriting = (id) => {
    setForm((prev) => ({
      ...prev,
      writing_tasks: prev.writing_tasks.filter((x) => x !== id),
    }));
  };

  const handleDragEndPassages = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setForm((prev) => {
        const oldIndex = prev.reading_passages.indexOf(active.id);
        const newIndex = prev.reading_passages.indexOf(over.id);
        return {
          ...prev,
          reading_passages: arrayMove(prev.reading_passages, oldIndex, newIndex),
        };
      });
    }
  };

  const handleDragEndSections = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setForm((prev) => {
        const oldIndex = prev.listening_sections.indexOf(active.id);
        const newIndex = prev.listening_sections.indexOf(over.id);
        return {
          ...prev,
          listening_sections: arrayMove(prev.listening_sections, oldIndex, newIndex),
        };
      });
    }
  };

  const handleDragEndWritings = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setForm((prev) => {
        const oldIndex = prev.writing_tasks.indexOf(active.id);
        const newIndex = prev.writing_tasks.indexOf(over.id);
        return {
          ...prev,
          writing_tasks: arrayMove(prev.writing_tasks, oldIndex, newIndex),
        };
      });
    }
  };

  const matchSearch = (item, query) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item._id || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q)
    );
  };

  const filteredPassages = passages.filter((p) => matchSearch(p, passageSearch));
  const filteredSections = sections.filter((s) => matchSearch(s, sectionSearch));
  const filteredWritings = writings.filter((w) => matchSearch(w, writingSearch));
  const filteredTests = tests.filter((t) => matchSearch(t, existingSearch));

  const getPassageTitle = (id) => passages.find((p) => p._id === id)?.title || id;
  const getPassageSubtitle = (id) => passages.find((p) => p._id === id)?._id || id;
  const getSectionTitle = (id) => sections.find((s) => s._id === id)?.title || id;
  const getSectionSubtitle = (id) => sections.find((s) => s._id === id)?._id || id;
  const getWritingTitle = (id) => writings.find((w) => w._id === id)?.title || id;
  const getWritingSubtitle = (id) => writings.find((w) => w._id === id)?._id || id;

  const handleDeleteTest = (testId) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Test',
      message: 'Are you sure you want to delete this test? This cannot be undone.',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.deleteTest(testId);
          showNotification('Test deleted.', 'success');
          const res = await api.getTests();
          setTests(res.data || []);
        } catch (err) {
          showNotification(err.message, 'error');
        }
      }
    });
  };

  const handleRenumber = () => {
    if (!editId) return;

    setModalConfig({
      isOpen: true,
      title: 'Tự động đánh số lại câu hỏi',
      message: 'Đây sẽ tự động đánh số lại tất cả các câu hỏi trong bài thi (1-40) và cập nhật tất cả các bài đọc/section toàn cục. Tiếp tục?',
      isDanger: false,
      onConfirm: async () => {
        setSubmitLoading(true);
        try {
          const res = await api.renumberTestQuestions(editId);
          showNotification(res.message || 'Câu hỏi đã được đánh số lại thành công.', 'success');
        } catch (err) {
          showNotification(err.message, 'error');
        } finally {
          setSubmitLoading(false);
        }
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form._id.trim() || !form.title.trim() || !form.category.trim()) {
      showNotification('ID, title, and category are required.', 'warning');
      return;
    }
    setSubmitLoading(true);
    try {
      const payload = {
        _id: form._id.trim(),
        title: form.title.trim(),
        category: form.category.trim() || 'Uncategorized',
        is_real_test: form.is_real_test,
        type: form.type || 'reading',
        duration: parseInt(form.duration) || 60,
        full_audio: form.type === 'listening' ? (form.full_audio?.trim() || null) : null,
        reading_passages: form.type === 'reading' ? form.reading_passages : [],
        listening_sections: form.type === 'listening' ? form.listening_sections : [],
        writing_tasks: form.type === 'writing' ? form.writing_tasks : [],
      };
      if (editId) {
        await api.updateTest(editId, payload);
        showNotification('Test updated.', 'success');
      } else {
        await api.createTest(payload);
        showNotification('Test created.', 'success');
        api.getTests().then((res) => setTests(res.data || [])).catch(() => { });
        setForm({
          _id: `test-${Date.now()}`,
          title: '',
          category: '',
          is_real_test: false,
          type: form.type,
          duration: form.type === 'reading' ? 60 : form.type === 'listening' ? 35 : 45,
          full_audio: '',
          reading_passages: [],
          listening_sections: [],
          writing_tasks: [],
        });
      }
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;
  if (editId && loadError) return <div className="manage-section"><p className="form-error">{loadError}</p><Link to="/manage/tests">Back to tests</Link></div>;

  return (
    <div className="manage-container">
      <h1>{editId ? 'Sửa bài thi (Full Test)' : 'Thêm bài thi (Full Test)'}</h1>
      {error && <p className="form-error">{error}</p>}

      <form onSubmit={handleSubmit} className="manage-form">
        <div className="form-row">
          <label>Mã bài thi (ID) *</label>
          <input
            value={form._id}
            onChange={(e) => updateForm('_id', e.target.value)}
            placeholder="e.g. test-1"
            required
            readOnly={!!editId}
          />
        </div>
        <div className="form-row">
          <label>Tiêu đề *</label>
          <input
            value={form.title}
            onChange={(e) => updateForm('title', e.target.value)}
            placeholder="e.g. Cambridge 18 - Test 1"
            required
          />
        </div>
        <div className="form-row">
          <label>Bộ đề / Danh mục *</label>
          <input
            value={form.category}
            onChange={(e) => updateForm('category', e.target.value)}
            placeholder="e.g. Cambridge 18"
            required
          />
          <small className="form-hint" style={{ color: '#d03939' }}>
            Dùng để nhóm các bài thi từ cùng một bộ sách.
          </small>
        </div>

        <div className="form-row">
          <label className="checkbox-label" style={{ fontWeight: 'bold' }}>
            <input
              type="checkbox"
              checked={form.is_real_test}
              onChange={(e) => updateForm('is_real_test', e.target.checked)}
            />
            Test Thật (Real Test) - Không cho xem kết quả chi tiết
          </label>
        </div>

        <div className="form-row">
          <label>Loại bài thi (Kỹ năng) *</label>
          <select
            value={form.type || 'reading'}
            onChange={(e) => {
              const newType = e.target.value;
              updateForm('type', newType);
              const defaultDuration = newType === 'reading' ? 60 : newType === 'listening' ? 35 : 60;
              updateForm('duration', defaultDuration);
            }}
          >
            <option value="reading">Reading only</option>
            <option value="listening">Listening only</option>
            <option value="writing">Writing only</option>
          </select>
        </div>

        <div className="form-row">
          <label>Thời gian làm bài (Phút) *</label>
          <input
            type="number"
            min="1"
            max="180"
            value={form.duration}
            onChange={(e) => updateForm('duration', e.target.value)}
            placeholder="e.g. 60"
            required
          />
          <small className="form-hint">
            Mặc định: Reading = 60p, Listening = 35p, Writing = 60p
          </small>
        </div>

        {form.type === 'reading' && (
          <div className="form-row multi-select-block" style={{ background: '#FFF9F1', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid #fdf4e3' }}>
            <label style={{ color: '#d03939', fontSize: '1rem' }}>Chọn bài Reading (kéo để sắp xếp)</label>
            <input
              type="search"
              value={passageSearch}
              onChange={(e) => setPassageSearch(e.target.value)}
              placeholder="Search passages by title or ID..."
              className="search-input"
              aria-label="Search passages"
            />
            {passageSearch.trim() && (
              <p className="search-hint">
                Showing {filteredPassages.length} of {passages.length} passage{passages.length !== 1 ? 's' : ''}
              </p>
            )}
            <div className="selection-grid">
              {passages.length === 0 ? (
                <p className="muted">Chưa có bài đọc nào. Tạo bài đọc trước.</p>
              ) : filteredPassages.length === 0 ? (
                <p className="muted">Không có bài đọc nào khớp với tìm kiếm của bạn.</p>
              ) : (
                filteredPassages.map((p) => {
                  const isSelected = form.reading_passages.includes(p._id);
                  return (
                    <div
                      key={p._id}
                      className={`selection-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => togglePassage(p._id)}
                    >
                      <div className="selection-card-header">
                        <span className="selection-card-title">{p.title}</span>
                        <div className="selection-card-checkbox"></div>
                      </div>
                      <span className="selection-card-id">{p._id}</span>
                    </div>
                  );
                })
              )}
            </div>

            {form.reading_passages.length > 0 && (
              <>
                <p className="selected-hint">Selected passages (drag ⋮⋮ to reorder):</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndPassages}>
                  <SortableContext items={form.reading_passages} strategy={verticalListSortingStrategy}>
                    <ul className="sortable-list">
                      {form.reading_passages.map((id) => (
                        <SortableItem key={id} id={id} title={getPassageTitle(id)} subtitle={getPassageSubtitle(id)} onRemove={removePassage} type="passage" />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>
        )}

        {form.type === 'listening' && (
          <div className="form-row multi-select-block" style={{ background: '#FFF9F1', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid #fdf4e3' }}>
            <label style={{ color: '#d03939', fontSize: '1rem' }}>Chọn bài Listening (kéo để sắp xếp)</label>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <label>Full Audio (Optional)</label>
              <input
                value={form.full_audio}
                onChange={(e) => updateForm('full_audio', e.target.value)}
                placeholder="https://example.com/full-listening.mp3"
              />
              <small className="form-hint">
                If set and the test has 4 sections, the exam will use this full audio instead of per-section audio.
              </small>
            </div>
            <input
              type="search"
              value={sectionSearch}
              onChange={(e) => setSectionSearch(e.target.value)}
              placeholder="Search sections by title or ID..."
              className="search-input"
              aria-label="Search sections"
            />
            {sectionSearch.trim() && (
              <p className="search-hint">
                Showing {filteredSections.length} of {sections.length} section{sections.length !== 1 ? 's' : ''}
              </p>
            )}
            <div className="selection-grid">
              {sections.length === 0 ? (
                <p className="muted">No sections yet. Create sections first.</p>
              ) : filteredSections.length === 0 ? (
                <p className="muted">No sections match your search.</p>
              ) : (
                filteredSections.map((s) => {
                  const isSelected = form.listening_sections.includes(s._id);
                  return (
                    <div
                      key={s._id}
                      className={`selection-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSection(s._id)}
                    >
                      <div className="selection-card-header">
                        <span className="selection-card-title">{s.title}</span>
                        <div className="selection-card-checkbox"></div>
                      </div>
                      <span className="selection-card-id">{s._id}</span>
                    </div>
                  );
                })
              )}
            </div>

            {form.listening_sections.length > 0 && (
              <>
                <p className="selected-hint">Selected sections (drag ⋮⋮ to reorder):</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndSections}>
                  <SortableContext items={form.listening_sections} strategy={verticalListSortingStrategy}>
                    <ul className="sortable-list">
                      {form.listening_sections.map((id) => (
                        <SortableItem key={id} id={id} title={getSectionTitle(id)} subtitle={getSectionSubtitle(id)} onRemove={removeSection} type="section" />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>
        )}

        {form.type === 'writing' && (
          <div className="form-row multi-select-block" style={{ background: '#FFF9F1', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid #fdf4e3' }}>
            <label style={{ color: '#d03939', fontSize: '1rem' }}>Writing tasks (drag to reorder)</label>
            <input
              type="search"
              value={writingSearch}
              onChange={(e) => setWritingSearch(e.target.value)}
              placeholder="Search writing tasks by title or ID..."
              className="search-input"
              aria-label="Search writing tasks"
            />
            {writingSearch.trim() && (
              <p className="search-hint">
                Showing {filteredWritings.length} of {writings.length} writing task{writings.length !== 1 ? 's' : ''}
              </p>
            )}
            <div className="selection-grid">
              {writings.length === 0 ? (
                <p className="muted">Chưa có bài viết nào. Tạo bài viết trước.</p>
              ) : filteredWritings.length === 0 ? (
                <p className="muted">Không có bài viết nào khớp với tìm kiếm của bạn.</p>
              ) : (
                filteredWritings.map((w) => {
                  const isSelected = form.writing_tasks.includes(w._id);
                  return (
                    <div
                      key={w._id}
                      className={`selection-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleWriting(w._id)}
                    >
                      <div className="selection-card-header">
                        <span className="selection-card-title">{w.title}</span>
                        <div className="selection-card-checkbox"></div>
                      </div>
                      <span className="selection-card-id">{w._id}</span>
                    </div>
                  );
                })
              )}
            </div>

            {form.writing_tasks.length > 0 && (
              <>
                <p className="selected-hint">Selected writing tasks (drag ⋮⋮ to reorder):</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndWritings}>
                  <SortableContext items={form.writing_tasks} strategy={verticalListSortingStrategy}>
                    <ul className="sortable-list">
                      {form.writing_tasks.map((id) => (
                        <SortableItem key={id} id={id} title={getWritingTitle(id)} subtitle={getWritingSubtitle(id)} onRemove={removeWriting} type="writing" />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '2rem' }}>
          <button type="submit" className="btn-manage-add" disabled={submitLoading} style={{ width: '100%', justifyContent: 'center', fontSize: '1.1rem', padding: '1.25rem' }}>
            {submitLoading ? (editId ? 'Đang lưu…' : 'Đang tạo…') : (editId ? 'Cập nhật bài thi' : 'Tạo bài thi mới')}
          </button>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            {editId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRenumber}
                disabled={submitLoading}
                style={{ flex: 1, background: '#FFF9F1', borderColor: '#fdf4e3', color: '#d03939', fontWeight: 700 }}
              >
                Auto Renumber Questions
              </button>
            )}

            {editId && <Link to="/manage/tests" className="btn btn-ghost" style={{ flex: 1, textAlign: 'center', border: '1px solid #e2e8f0' }}>Hủy bỏ</Link>}
          </div>
        </div>
      </form>

      <div className="search-container" style={{ marginTop: '4rem', paddingTop: '3rem', borderTop: '2px solid #FFF9F1' }}>
        <h3 style={{ color: '#d03939' }}>Các bài thi hiện có trong hệ thống</h3>
        {!editId && (
          <>
            <div className="search-box">
              <input
                type="search"
                value={existingSearch}
                onChange={(e) => setExistingSearch(e.target.value)}
                placeholder="Tìm kiếm theo tiêu đề hoặc ID..."
                className="test-search-input"
              />
            </div>
            {existingSearch.trim() && (
              <p className="search-hint">
                Đang hiện {filteredTests.length} trên {tests.length} bài
              </p>
            )}
            <div className="manage-list">
              {tests.length === 0 ? <p className="muted">Chưa có bài thi nào.</p> : filteredTests.length === 0 ? (
                <p className="muted">Không tìm thấy bài thi nào phù hợp.</p>
              ) : filteredTests
                .slice()
                .reverse()
                .filter((_, i) => existingSearch.trim() ? true : i < 10)
                .map((t) => (
                  <div key={t._id} className="list-item">
                    <div className="item-info">
                      <span className="item-title">{t.title}</span>
                      <span className="item-meta">ID: {t._id} | {t.category || 'Uncategorized'}</span>
                    </div>
                    <div className="item-actions">
                      <Link to={`/manage/tests/${t._id}`} className="btn btn-ghost btn-sm">Sửa</Link>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteTest(t._id)} style={{ color: '#ef4444' }}>Xóa</button>
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        isDanger={modalConfig.isDanger}
      />
    </div>
  );
}
