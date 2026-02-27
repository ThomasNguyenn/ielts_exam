import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';

const normalizeCode = (value = '') =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);

export default function WritingLiveJoin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalized = normalizeCode(code);
    if (!normalized) {
      setError('Please enter a room code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.resolveWritingLiveRoom(normalized);
      const route = response?.data?.route || '';
      if (!route) {
        throw new Error('Unable to resolve room.');
      }
      navigate(route);
    } catch (submitError) {
      setError(submitError?.message || 'Room code expired or invalid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <h1 style={{ marginBottom: 12 }}>Join Writing Live Room</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Enter the code provided by your teacher to join the live writing review.
      </p>
      <form onSubmit={handleSubmit} style={{ marginTop: 20, display: 'grid', gap: 12 }}>
        <label htmlFor="writing-live-code" style={{ fontWeight: 600 }}>Room code</label>
        <input
          id="writing-live-code"
          type="text"
          value={code}
          onChange={(event) => {
            setCode(normalizeCode(event.target.value));
          }}
          placeholder="Example: AB12CD"
          autoComplete="off"
          maxLength={10}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #d1d5db',
            fontSize: 16,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        />
        {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Joining...' : 'Join room'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/profile')} disabled={loading}>
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

