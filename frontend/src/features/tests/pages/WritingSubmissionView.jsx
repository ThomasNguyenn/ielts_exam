import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';

const formatDateTime = (value) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('vi-VN');
};

const formatDuration = (timeTakenMs) => {
  const ms = Number(timeTakenMs);
  if (!Number.isFinite(ms) || ms <= 0) return '--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes} phút ${seconds} giây`;
  return `${seconds} giây`;
};

const normalizeStatusLabel = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'scored' || normalized === 'reviewed') return 'Đã chấm';
  if (normalized === 'processing') return 'Đang xử lý';
  if (normalized === 'failed') return 'Lỗi chấm điểm';
  return normalized ? normalized : 'Chờ chấm';
};

export default function WritingSubmissionView() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submission, setSubmission] = useState(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    setError('');

    api.getSubmissionStatus(id)
      .then((response) => {
        if (!mounted) return;
        setSubmission(response?.data || null);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.message || 'Không thể tải bài viết.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const writingAnswers = useMemo(
    () => (Array.isArray(submission?.writing_answers) ? submission.writing_answers : []),
    [submission],
  );

  if (loading) return <div className="page"><p className="muted">Loading writing...</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p><Link to="/profile">Back to profile</Link></div>;
  if (!submission) return <div className="page"><p className="muted">Submission not found.</p></div>;

  return (
    <div className="page" style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Your Writing Submission</h1>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Nộp lúc {formatDateTime(submission.submitted_at)} • Trạng thái: {normalizeStatusLabel(submission.status)} • Thời gian làm bài: {formatDuration(submission.time_taken_ms)}
          </p>
          {Number.isFinite(Number(submission.score)) ? (
            <p style={{ marginTop: '0.25rem', fontWeight: 700, color: '#4F46E5' }}>Band: {Number(submission.score).toFixed(1)}</p>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/profile" className="btn btn-ghost">Về hồ sơ</Link>
          <Link to={`/tests/writing/result-ai/${submission._id}`} className="btn btn-primary">Xem AI Result</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {writingAnswers.length ? (
          writingAnswers.map((answer, index) => (
            <section key={`writing-answer-${index}`} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{answer?.task_title || `Task ${index + 1}`}</h2>
              <p className="muted" style={{ marginTop: '0.35rem' }}>
                {Number.isFinite(Number(answer?.word_count)) ? `${Number(answer.word_count)} words` : 'Word count unavailable'}
              </p>
              <div style={{ marginTop: '0.75rem', whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#0f172a' }}>
                {String(answer?.answer_text || '').trim() || 'No answer text.'}
              </div>
            </section>
          ))
        ) : (
          <div className="muted">No writing answers found.</div>
        )}
      </div>
    </div>
  );
}
