import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import './TestHistory.css';

// Helper to separate date and time
function formatDateParts(val) {
  if (!val) return { date: '--', time: '--' };
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return { date: '--', time: '--' };

  // YY/MM/DD format
  const year = d.getFullYear().toString().slice(-2);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');

  // HH:MM:SS format
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  const secs = d.getSeconds().toString().padStart(2, '0');

  return {
    date: `${day}/${month}/${year}`,
    time: `${hours}:${mins}:${secs}`
  };
}

function formatDuration(ms) {
  if (!ms || typeof ms !== 'number') return '--';
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

export default function TestHistory() {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.getTestById(id), api.getMyTestHistory(id)])
      .then(([testRes, attemptsRes]) => {
        setTest(testRes.data || null);
        setAttempts(attemptsRes.data || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const scoredAttempts = attempts.map((a) => {
    const pct = typeof a.percentage === 'number'
      ? a.percentage
      : a.total
        ? Math.round((a.score / a.total) * 100)
        : 0;

    // Backend now stores `skipped`. If present, use it.
    // If undefined (old data), assume 0 or infer from wrong if logic was total-score=wrong
    // But previously wrong included separate skipped. 
    // Let's rely on new backend logic: total = score + wrong + skipped.

    const skipped = typeof a.skipped === 'number' ? a.skipped : 0;
    // Fallback for wrong if calculated differently in old data
    const wrong = typeof a.wrong === 'number' ? a.wrong : (a.total ? a.total - a.score - skipped : 0);

    return { ...a, pct, calculatedWrong: wrong, calculatedSkipped: skipped };
  })
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)); // Latest first

  if (loading) return <div className="page"><p className="muted">Loading history...</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p><Link to="/tests">Back to tests</Link></div>;

  return (
    <div className="page test-history" style={{ maxWidth: '1200px' }}>
      <div className="test-history-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>{test?.title || 'Test history'}</h1>
          <p className="muted">{test?.type ? `${test.type[0].toUpperCase() + test.type.slice(1)} test` : ''}</p>
        </div>
        <div className="test-history-actions">
          <Link to={`/tests/${id}`} className="btn btn-primary">Bắt đầu bài thi</Link>
          <Link to="/tests" className="btn btn-ghost">Quay lại danh sách bài thi</Link>
        </div>
      </div>

      {scoredAttempts.length === 0 ? (
        <p className="muted">No attempts yet.</p>
      ) : (
        <div className="history-table-container" style={{ overflowX: 'auto', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Tên bài</th>
                <th style={{ padding: '1rem' }}>Thời gian<br />nộp bài</th>
                {test?.type === 'writing' ? (
                  <>
                    <th style={{ padding: '1rem' }}>Task 1</th>
                    <th style={{ padding: '1rem' }}>Task 2</th>
                    <th style={{ padding: '1rem' }}>Overall (Band)</th>
                    <th style={{ padding: '1rem' }}>Nhận xét</th>
                  </>
                ) : (
                  <>
                    <th style={{ padding: '1rem' }}>Thời gian<br />làm bài</th>
                    <th style={{ padding: '1rem' }}>Tổng<br />số câu</th>
                    <th style={{ padding: '1rem', background: '#22c55e', color: 'white' }}>Đúng</th>
                    <th style={{ padding: '1rem' }}>Sai</th>
                    <th style={{ padding: '1rem' }}>Bỏ qua</th>
                    <th style={{ padding: '1rem', width: '150px' }}>Tỉ lệ đúng</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {scoredAttempts.map((a, index) => {
                const { date, time } = formatDateParts(a.submitted_at);
                const duration = formatDuration(a.time_taken_ms);
                const isWriting = test?.type === 'writing';
                const w = a.writing_details || {};

                return (
                  <tr key={a._id || index} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '1rem', textAlign: 'left', fontWeight: 500, color: '#334155' }}>
                      {test ? test.title : 'Loading...'}
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                      <div style={{ fontWeight: 500, color: '#334155' }}>{date}</div>
                      <div>{time}</div>
                    </td>

                    {isWriting ? (
                      <>
                        <td style={{ padding: '1rem' }}>{w.task1_score ?? '--'}</td>
                        <td style={{ padding: '1rem' }}>{w.task2_score ?? '--'}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ fontWeight: 'bold', color: '#4F46E5' }}>{a.score ?? '--'}</span>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem', textAlign: 'left', maxWidth: '300px' }}>
                          {w.feedback ? (
                            <div style={{ maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre-wrap' }}>
                              {w.feedback}
                            </div>
                          ) : <span className="muted">No feedback yet</span>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '1rem', color: '#64748b' }}>
                          {duration}
                        </td>
                        <td style={{ padding: '1rem', color: '#334155' }}>
                          {a.total || 0}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            color: '#22c55e',
                            fontWeight: 600,
                            background: '#dcfce7',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '999px',
                            display: 'inline-block',
                            minWidth: '2rem'
                          }}>
                            {a.score || 0}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            color: '#ef4444',
                            fontWeight: 600,
                            background: '#fee2e2',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '999px',
                            display: 'inline-block',
                            minWidth: '2rem'
                          }}>
                            {a.calculatedWrong}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            color: '#64748b',
                            fontWeight: 600,
                            background: '#f1f5f9',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '999px',
                            display: 'inline-block',
                            minWidth: '2rem'
                          }}>
                            {a.calculatedSkipped}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontWeight: 700, color: '#334155', textAlign: 'left' }}>
                              {a.pct}%
                            </span>
                            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${a.pct}%`, height: '100%', background: '#22c55e' }} />
                            </div>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
