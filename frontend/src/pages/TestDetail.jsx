import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import './TestDetail.css';

function getTestTypeInfo(test) {
  const readingCount = test.reading_passages?.length ?? 0;
  const listeningCount = test.listening_sections?.length ?? 0;
  const writingCount = test.writing_tasks?.length ?? 0;

  const type = test.type || 'reading';

  let metaItems = [];
  let description = '';

  if (type === 'reading') {
    metaItems = [
      { label: 'Reading', count: readingCount, unit: 'passage' }
    ];
    description = `Take the reading test: ${readingCount} passage${readingCount !== 1 ? 's' : ''} with questions.`;
  } else if (type === 'listening') {
    metaItems = [
      { label: 'Listening', count: listeningCount, unit: 'section' }
    ];
    description = `Take the listening test: ${listeningCount} section${listeningCount !== 1 ? 's' : ''} with questions.`;
  } else if (type === 'writing') {
    metaItems = [
      { label: 'Writing', count: writingCount, unit: 'task' }
    ];
    description = `Take the writing test: ${writingCount} task${writingCount !== 1 ? 's' : ''} with prompts.`;
  } else {
    // Fallback - show all available
    if (readingCount > 0) {
      metaItems.push({ label: 'Reading', count: readingCount, unit: 'passage' });
    }
    if (listeningCount > 0) {
      metaItems.push({ label: 'Listening', count: listeningCount, unit: 'section' });
    }
    if (writingCount > 0) {
      metaItems.push({ label: 'Writing', count: writingCount, unit: 'task' });
    }
    description = 'Take the full test.';
  }

  return { metaItems, description };
}

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

  const { metaItems, description } = getTestTypeInfo(test);

  return (
    <div className="page test-detail">
      <h1>{test.title}</h1>
      <div className="test-meta">
        {metaItems.map((item, index) => (
          <span key={index}>
            {item.label}: {item.count} {item.unit}{item.count !== 1 ? 's' : ''}
          </span>
        ))}
      </div>
      <section className="exam-start">
        <p>{description}</p>
        <Link to={`/tests/${id}/exam`} className="btn btn-primary">
          Start exam
        </Link>
      </section>
    </div>
  );
}
