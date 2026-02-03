import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function TestList() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getTests()
      .then((res) => setTests(res.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><p className="muted">Loading tests…</p></div>;
  if (error) return <div className="page"><p className="error">Error: {error}</p></div>;

  return (
    <div className="page test-list">
      <h1>Available tests</h1>
      {tests.length === 0 ? (
        <p className="muted">No tests yet. Add tests in the backend.</p>
      ) : (
        <ul className="test-cards">
          {tests.map((test) => (
            <li key={test._id} className="test-card">
              <h2>{test.title}</h2>
              <p className="muted">
                Reading passages · Listening sections
              </p>
              <Link to={`/tests/${test._id}`} className="btn btn-primary">
                Start test
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
