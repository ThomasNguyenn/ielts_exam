import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { isStudentFamilyRole } from '@/app/roleRouting';
import {
  Sparkles, User, Mail, Lock,
  BookOpen, Check, AlertCircle
} from 'lucide-react';
import './Auth.css';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = String(searchParams.get('invite') || '').trim();
  const normalizedInviteToken = inviteToken.includes(' ')
    ? inviteToken.replace(/\s+/g, '+')
    : inviteToken;

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    studyTrack: 'ielts',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [inviteData, setInviteData] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  useEffect(() => {
    if (!normalizedInviteToken) return;

    setInviteLoading(true);
    setInviteData(null);
    setInviteError(null);

    api.validateInvitation(normalizedInviteToken)
      .then((res) => {
        const payload = res && typeof res === 'object' ? res : {};
        const invitePayload = payload?.data && typeof payload.data === 'object'
          ? payload.data
          : payload;
        const isValid = Boolean(payload?.valid ?? invitePayload?.valid);

        if (isValid) {
          const invitedEmail = String(invitePayload?.email || '').trim();
          const invitedRole = String(invitePayload?.role || '').trim();
          setInviteData({ email: invitedEmail, role: invitedRole });
          setForm((prev) => ({ ...prev, email: invitedEmail }));
        } else {
          setInviteData(null);
          setInviteError('Invitation is invalid or expired.');
        }
      })
      .catch(() => {
        setInviteData(null);
        setInviteError('Invitation is invalid or expired.');
      })
      .finally(() => setInviteLoading(false));
  }, [normalizedInviteToken]);

  const roleLabel = inviteData?.role === 'admin'
    ? 'Admin'
    : inviteData?.role === 'teacher'
      ? 'Teacher'
      : 'Student';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!inviteData && !['ielts', 'aca'].includes(String(form.studyTrack || '').trim().toLowerCase())) {
      setError('Please choose a study track.');
      return;
    }

    setLoading(true);

    try {
      const registerData = {
        name: form.name,
        email: form.email,
        password: form.password,
      };

      if (normalizedInviteToken) {
        registerData.inviteToken = normalizedInviteToken;
      } else {
        registerData.studyTrack = form.studyTrack;
      }

      const res = await api.register(registerData);

      api.setToken(res.data.token);
      api.setUser(res.data.user);

      if (!res.data.user.isConfirmed && isStudentFamilyRole(res.data.user.role)) {
        navigate('/wait-for-confirmation');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-container">
        <div className="auth-brand-panel">
          <div className="auth-brand-content">
            <div className="auth-brand-logo">
              <div className="auth-brand-logo-icon">
                <BookOpen />
              </div>
              <span className="auth-brand-logo-text">IELTS Pro</span>
            </div>

            <h2 className="auth-brand-tagline">Create your account</h2>
            <p className="auth-brand-desc">
              Register to access tests, AI feedback, and personalized learning analytics.
            </p>

            <ul className="auth-brand-features">
              <li>
                <span className="auth-feature-check"><Check /></span>
                Real Reading and Listening tests
              </li>
              <li>
                <span className="auth-feature-check"><Check /></span>
                AI writing feedback
              </li>
              <li>
                <span className="auth-feature-check"><Check /></span>
                Speaking practice with AI
              </li>
              <li>
                <span className="auth-feature-check"><Check /></span>
                Progress tracking
              </li>
            </ul>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-header">
            <div className="auth-greeting">
              <Sparkles /> New account
            </div>
            <h1>Register</h1>
            <p>Fill in your details to continue</p>
          </div>

          {inviteLoading && (
            <div className="auth-info" style={{ padding: '12px', background: 'var(--surface-2, #f0f4ff)', borderRadius: 8, marginBottom: 16 }}>
              Validating invitation...
            </div>
          )}

          {inviteError && (
            <div className="auth-error">
              <AlertCircle />
              {inviteError}
            </div>
          )}

          {inviteData && (
            <div style={{ padding: '12px 16px', background: 'var(--surface-2, #f0f4ff)', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
              <strong>Invited role: {roleLabel}</strong>
            </div>
          )}

          {error && (
            <div className="auth-error">
              <AlertCircle />
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field-row">
              <div className="auth-field">
                <label>Full name</label>
                <div className="auth-input-wrapper">
                  <User className="auth-input-icon" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nguyen Van A"
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label>Email</label>
                <div className="auth-input-wrapper">
                  <Mail className="auth-input-icon" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => !inviteData && setForm({ ...form, email: e.target.value })}
                    placeholder="your@email.com"
                    required
                    readOnly={!!inviteData}
                    style={inviteData ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
                  />
                </div>
              </div>
            </div>

            <div className="auth-field-row">
              {!inviteData ? (
                <div className="auth-field">
                  <label>Study track</label>
                  <div className="auth-input-wrapper">
                    <BookOpen className="auth-input-icon" />
                    <select
                      value={form.studyTrack}
                      onChange={(e) => setForm({ ...form, studyTrack: e.target.value })}
                      required
                    >
                      <option value="ielts">IELTS</option>
                      <option value="aca">Academic</option>
                    </select>
                  </div>
                </div>
              ) : null}

              <div className="auth-field">
                <label>Password</label>
                <div className="auth-input-wrapper">
                  <Lock className="auth-input-icon" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="At least 8 characters"
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label>Confirm password</label>
                <div className="auth-input-wrapper">
                  <Lock className="auth-input-icon" />
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    required
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading || inviteLoading || !!inviteError}>
              {loading ? 'Registering...' : 'Create account'}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
