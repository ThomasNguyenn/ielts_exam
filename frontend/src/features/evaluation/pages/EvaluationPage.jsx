import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/shared/api/client';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  Sparkles,
  ListPlus,
} from 'lucide-react';
import './EvaluationPage.css';

const STORAGE_KEY = 'scots_evaluation_state';
const STORAGE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const saveToLocal = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch { /* ignore */ }
};

const loadFromLocal = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (Date.now() - parsed.timestamp > STORAGE_TTL) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const clearLocal = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
};

const STATUS_MAP = {
  pending: { label: 'Chờ xử lý', cls: 'eval-status--pending' },
  processing: { label: 'Đang viết…', cls: 'eval-status--processing', spin: true },
  completed: { label: 'Hoàn tất', cls: 'eval-status--completed', icon: CheckCircle2 },
  error: { label: 'Lỗi', cls: 'eval-status--error', icon: AlertCircle },
};

const EvaluationPage = () => {
  const [studentNamesInput, setStudentNamesInput] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);
  const studentsRef = useRef(students);
  studentsRef.current = students;

  // ── Load from localStorage on mount ──
  useEffect(() => {
    const saved = loadFromLocal();
    if (saved) {
      setStudentNamesInput(saved.studentNamesInput || '');
      setTeacherName(saved.teacherName || '');
      setDate(saved.date || new Date().toISOString().split('T')[0]);
      setStudents(saved.students || []);
      setRequestId(saved.requestId || null);
      if (saved.requestId && saved.pollingActive) setPollingActive(true);
    }
  }, []);

  // ── Persist to localStorage ──
  useEffect(() => {
    saveToLocal({ studentNamesInput, teacherName, date, students, requestId, pollingActive });
  }, [studentNamesInput, teacherName, date, students, requestId, pollingActive]);

  // ── Process list ──
  const handleProcessList = () => {
    const names = studentNamesInput.split('\n').map((n) => n.trim()).filter(Boolean);
    const newStudents = names.map((name) => {
      const existing = students.find((s) => s.name === name);
      return {
        name,
        lessonInfo: existing?.lessonInfo || '',
        status: existing?.status || 'pending',
        result: existing?.result || null,
      };
    });
    setStudents(newStudents);
  };

  const handleUpdateLessonInfo = (index, value) => {
    setStudents((prev) => prev.map((s, i) => (i === index ? { ...s, lessonInfo: value } : s)));
  };

  // ── Submit ──
  const handleAutoEvaluate = async () => {
    if (!teacherName || !date || students.length === 0) {
      alert('Vui lòng điền đầy đủ Tên giáo viên, Ngày và ít nhất một học viên.');
      return;
    }
    setIsProcessing(true);
    try {
      const response = await api.submitEvaluation({
        students: students.map((s) => ({ name: s.name, lessonInfo: s.lessonInfo })),
        teacherName,
        date,
      });
      if (response.success) {
        setRequestId(response.requestId);
        setPollingActive(true);
      }
    } catch (error) {
      console.error('Error submitting evaluations:', error);
      alert('Gửi nhận xét thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Polling ──
  const pollStatus = useCallback(async () => {
    if (!requestId || !pollingActive) return;
    try {
      const response = await api.getEvaluationStatus(requestId);
      if (response.success) {
        const current = studentsRef.current;
        const updatedStudents = current.map((s, idx) => {
          const task = response.tasks.find((t) => t.id === idx);
          return task ? { ...s, status: task.status, result: task.result } : s;
        });
        setStudents(updatedStudents);
        if (response.completedCount >= response.totalCount) setPollingActive(false);
      }
    } catch (error) {
      console.error('Polling error:', error);
      setPollingActive(false);
    }
  }, [requestId, pollingActive]);

  useEffect(() => {
    if (!pollingActive) return;
    const id = setInterval(pollStatus, 3000);
    return () => clearInterval(id);
  }, [pollingActive, pollStatus]);

  const handleCopy = (text) => navigator.clipboard.writeText(text);

  const handleReset = () => {
    if (!window.confirm('Bạn có chắc muốn xóa toàn bộ dữ liệu không?')) return;
    clearLocal();
    setStudentNamesInput('');
    setTeacherName('');
    setDate(new Date().toISOString().split('T')[0]);
    setStudents([]);
    setRequestId(null);
    setPollingActive(false);
  };

  const completedCount = students.filter((s) => s.status === 'completed').length;

  return (
    <div className="eval-page">
      {/* ── Header ── */}
      <div className="eval-header">
        <h1>Nhận Xét Buổi Học</h1>
        <p>Tạo nhận xét tự động bằng AI cho từng học viên — SCOTS Cẩm Phả</p>
      </div>

      {/* ── Top stat cards ── */}
      <div className="eval-stats-grid">
        <div className="eval-stat-card">
          <label>Tên giáo viên</label>
          <input
            type="text"
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
            placeholder="Nhập tên giáo viên..."
          />
        </div>
        <div className="eval-stat-card">
          <label>Ngày học</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="eval-stat-card">
          <label>Tiến độ</label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
              {completedCount}/{students.length}
            </span>
            <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500 }}>học viên hoàn tất</span>
          </div>
        </div>
      </div>

      {/* ── Input area (two columns) ── */}
      <div className="eval-input-grid">
        <div className="eval-card">
          <div className="eval-card-head">
            <div>
              <h3>Danh sách học viên</h3>
              <p>Nhập mỗi tên học viên trên một dòng</p>
            </div>
          </div>
          <textarea
            className="eval-student-input"
            placeholder="Nguyễn Văn A&#10;Trần Thị B&#10;Lê Văn C"
            value={studentNamesInput}
            onChange={(e) => setStudentNamesInput(e.target.value)}
          />
          <div className="eval-actions" style={{ marginTop: '0.75rem' }}>
            <button className="eval-btn eval-btn-secondary" onClick={handleProcessList}>
              <ListPlus size={15} /> Xử lý danh sách
            </button>
          </div>
        </div>

        <div className="eval-card">
          <div className="eval-card-head">
            <div>
              <h3>Hành động</h3>
              <p>Gửi dữ liệu cho AI viết nhận xét tự động</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              className="eval-btn eval-btn-primary"
              onClick={handleAutoEvaluate}
              disabled={isProcessing || pollingActive || students.length === 0}
              style={{ justifyContent: 'center', padding: '0.65rem 1.25rem' }}
            >
              {isProcessing || pollingActive ? (
                <>
                  <Loader2 className="eval-spin" size={15} /> Đang xử lý…
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Tự động nhận xét
                </>
              )}
            </button>
            <button className="eval-btn eval-btn-danger" onClick={handleReset}>
              <Trash2 size={15} /> Xóa toàn bộ
            </button>
          </div>
          {pollingActive && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#eff6ff', fontSize: '0.8rem', color: '#3b82f6', fontWeight: 500 }}>
              ⏳ AI đang viết nhận xét… Kết quả sẽ hiển thị tự động.
            </div>
          )}
        </div>
      </div>

      {/* ── Results Table ── */}
      {students.length > 0 && (
        <div className="eval-card">
          <div className="eval-card-head">
            <div>
              <h3>Bảng nhận xét</h3>
              <p>{students.length} học viên — {completedCount} hoàn tất</p>
            </div>
          </div>
          <table className="eval-table">
            <thead>
              <tr>
                <th style={{ width: '140px' }}>Học viên</th>
                <th style={{ width: '200px' }}>Nội dung bài học</th>
                <th style={{ width: '100px' }}>Trạng thái</th>
                <th>Nhận xét cuối cùng</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => {
                const statusInfo = STATUS_MAP[student.status] || STATUS_MAP.pending;
                const StatusIcon = statusInfo.icon;
                return (
                  <tr key={index}>
                    <td className="eval-student-name">{student.name}</td>
                    <td>
                      <textarea
                        className="eval-inline-textarea"
                        value={student.lessonInfo}
                        onChange={(e) => handleUpdateLessonInfo(index, e.target.value)}
                        placeholder="Nội dung đã dạy…"
                      />
                    </td>
                    <td>
                      <span className={`eval-status ${statusInfo.cls}`}>
                        {statusInfo.spin && <Loader2 className="eval-spin" size={12} />}
                        {StatusIcon && <StatusIcon size={12} />}
                        {statusInfo.label}
                      </span>
                    </td>
                    <td>
                      {student.result ? (
                        <div className="eval-result-box">
                          <pre className="eval-result-pre">{student.result}</pre>
                          <button className="eval-copy-btn" onClick={() => handleCopy(student.result)} title="Sao chép">
                            <Copy size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="eval-muted">Chưa có kết quả</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EvaluationPage;
