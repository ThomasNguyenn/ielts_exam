import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function TestDetail() {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    api
      .getTestById(id)
      .then((res) => setTest(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page"><p className="muted">Loading test…</p></div>;
  if (error) return <div className="page"><p className="error">Error: {error}</p></div>;
  if (!test) return <div className="page"><p className="muted">Test not found.</p></div>;

  const readingCount = test.reading_passages?.length ?? 0;
  const listeningCount = test.listening_sections?.length ?? 0;

  return (
    <div className="page test-detail">
      <h1>{test.title}</h1>
      <div className="test-meta">
        <span>Reading: {readingCount} passage{readingCount !== 1 ? 's' : ''}</span>
        <span>Listening: {listeningCount} section{listeningCount !== 1 ? 's' : ''}</span>
      </div>
      <section className="exam-start">
        <p>Take the full test: reading passages and listening sections with questions.</p>
        <Link to={`/tests/${id}/exam`} className="btn btn-primary">
          Start exam
        </Link>
      </section>
    </div>
  );
}
