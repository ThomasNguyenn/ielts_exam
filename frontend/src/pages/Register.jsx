import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '', 
    role: 'student',
    giftcode: '' 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [giftcodeError, setGiftcodeError] = useState(null);
  const [verifyingGiftcode, setVerifyingGiftcode] = useState(false);
  const latestGiftcodeCheckRef = useRef('');

  // Giftcode is only required for teacher/admin
  const requiresGiftcode = form.role === 'teacher' || form.role === 'admin';

  // Validate giftcode when role changes
  useEffect(() => {
    if (!requiresGiftcode) {
      setGiftcodeError(null);
      setVerifyingGiftcode(false);
      return;
    }

    const normalizedCode = form.giftcode.trim().toUpperCase();
    if (!normalizedCode) {
      setGiftcodeError(null);
      setVerifyingGiftcode(false);
      return;
    }

    const requestKey = `${form.role}:${normalizedCode}`;
    latestGiftcodeCheckRef.current = requestKey;

    const timeoutId = setTimeout(() => {
      validateGiftcode(normalizedCode, form.role, requestKey);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [form.role, form.giftcode]);

  const validateGiftcode = async (code, role, requestKey) => {
    if (!code) {
      setGiftcodeError('Giftcode is required for ' + role);
      return;
    }

    setVerifyingGiftcode(true);
    setGiftcodeError(null);

    try {
      const res = await api.verifyGiftcode({ giftcode: code, role });
      if (latestGiftcodeCheckRef.current !== requestKey) return;
      const isValid = res?.data?.valid ?? res?.valid ?? false;
      if (!isValid) {
        setGiftcodeError('Invalid giftcode for ' + role + ' role');
      } else {
        setGiftcodeError(null);
      }
    } catch (err) {
      if (latestGiftcodeCheckRef.current !== requestKey) return;
      setGiftcodeError('Invalid giftcode');
    } finally {
      if (latestGiftcodeCheckRef.current === requestKey) {
        setVerifyingGiftcode(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // Validate giftcode for teacher/admin
    if (requiresGiftcode) {
      if (!form.giftcode.trim()) {
        setError('Giftcode is required for ' + form.role + ' registration');
        return;
      }
      if (giftcodeError || verifyingGiftcode) {
        setError('Please enter a valid giftcode');
        return;
      }
    }

    setLoading(true);

    try {
      const { confirmPassword, ...registerData } = form;
      const res = await api.register(registerData);
      api.setToken(res.data.token);
      api.setUser(res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h1>Register</h1>
        {error && <p className="form-error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
              required
            />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="your@email.com"
              required
            />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 6 characters"
              required
            />
          </div>
          <div className="form-row">
            <label>Confirm Password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="Confirm your password"
              required
            />
          </div>
          <div className="form-row">
            <label>Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value, giftcode: '' })}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          
          {requiresGiftcode && (
            <div className={`form-row ${giftcodeError ? 'has-error' : ''}`}>
              <label>
                Giftcode *
                <span className="form-hint">(Required for {form.role})</span>
              </label>
              <input
                type="text"
                value={form.giftcode}
                onChange={(e) => setForm({ ...form, giftcode: e.target.value.toUpperCase() })}
                placeholder="Enter giftcode"
                required
              />
              {verifyingGiftcode && <span className="form-hint">Verifying...</span>}
              {giftcodeError && <span className="form-error">{giftcodeError}</span>}
              {!giftcodeError && form.giftcode && !verifyingGiftcode && (
                <span className="form-success">Valid giftcode</span>
              )}
              <small className="form-hint">
                Contact administrator for teacher giftcode
              </small>
            </div>
          )}
          
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="auth-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
