import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import {
  Sparkles, User, Mail, Lock, Shield, Gift,
  BookOpen, Check, AlertCircle
} from 'lucide-react';
import './Auth.css';

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

      // If we got a token, it means auto-login (or we could change backend to not return token if verification required)
      // But based on our new backend, we DO return token but also a message.
      // However, if strict verification is on, maybe we shouldn't login?
      // For now, let's show the success message and NOT auto-login if we want them to verify.
      // But the backend DOES return a token.
      // Let's check the backend logic again.
      // Backend: 
      // if (!user.isConfirmed) sendVerificationEmail
      // token = issueTokenForUser...
      // res.json({ ..., token, message: "Registration successful..." })

      // So the user IS logged in. They can use the app.
      // But we want to tell them to check email.
      // If `isConfirmed` is enforced in `ProtectedRoute`, they will be redirected to `/wait-for-confirmation`.
      // Let's use that flow.

      api.setToken(res.data.token);
      api.setUser(res.data.user);

      // If user is not confirmed (which they won't be), ProtectedRoute will handle it?
      // Or we can explicitly verify:
      if (!res.data.user.isConfirmed && res.data.user.role === 'student') {
        // We can redirect to /wait-for-confirmation or show a modal here.
        // Let's redirect to a new "check email" page or use /wait-for-confirmation which seems to exist.
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
        {/* Left — Brand Panel */}
        <div className="auth-brand-panel">
          <div className="auth-brand-content">
            <div className="auth-brand-logo">
              <div className="auth-brand-logo-icon">
                <BookOpen />
              </div>
              <span className="auth-brand-logo-text">IELTS Master</span>
            </div>

            <h2 className="auth-brand-tagline">
              Bắt đầu hành trình chinh phục IELTS
            </h2>
            <p className="auth-brand-desc">
              Tạo tài khoản miễn phí để truy cập hàng trăm đề thi, nhận phản hồi từ AI và theo dõi tiến trình học tập.
            </p>

            <ul className="auth-brand-features">
              <li>
                <span className="auth-feature-check"><Check /></span>
                Đề thi Reading & Listening thực tế
              </li>
              <li>
                <span className="auth-feature-check"><Check /></span>
                AI chấm Writing chi tiết
              </li>
              <li>
                <span className="auth-feature-check"><Check /></span>
                Luyện Speaking với AI
              </li>
              <li>
                <span className="auth-feature-check"><Check /></span>
                Hoàn toàn miễn phí cho học sinh
              </li>
            </ul>
          </div>
        </div>

        {/* Right — Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-form-header">
            <div className="auth-greeting">
              <Sparkles /> Tạo tài khoản mới
            </div>
            <h1>Đăng ký</h1>
            <p>Điền thông tin bên dưới để bắt đầu</p>
          </div>

          {error && (
            <div className="auth-error">
              <AlertCircle />
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field-row">
              <div className="auth-field">
                <label>Họ và tên</label>
                <div className="auth-input-wrapper">
                  <User className="auth-input-icon" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nguyễn Văn A"
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
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="auth-field-row">
              <div className="auth-field">
                <label>Mật khẩu</label>
                <div className="auth-input-wrapper">
                  <Lock className="auth-input-icon" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Ít nhất 6 ký tự"
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label>Xác nhận mật khẩu</label>
                <div className="auth-input-wrapper">
                  <Lock className="auth-input-icon" />
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Nhập lại mật khẩu"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="auth-field">
              <label>Vai trò</label>
              <div className="auth-input-wrapper">
                <Shield className="auth-input-icon" />
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value, giftcode: '' })}
                >
                  <option value="student">Học sinh</option>
                  <option value="teacher">Giáo viên</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </div>
            </div>

            {requiresGiftcode && (
              <div className="auth-field">
                <label>
                  Mã quà tặng *
                  <span className="form-hint" style={{ marginLeft: 8, fontWeight: 400 }}>
                    (Bắt buộc cho {form.role === 'teacher' ? 'giáo viên' : 'quản trị viên'})
                  </span>
                </label>
                <div className="auth-input-wrapper">
                  <Gift className="auth-input-icon" />
                  <input
                    type="text"
                    value={form.giftcode}
                    onChange={(e) => setForm({ ...form, giftcode: e.target.value.toUpperCase() })}
                    placeholder="Nhập mã quà tặng"
                    required
                  />
                </div>
                {verifyingGiftcode && <span className="form-hint">Đang xác minh...</span>}
                {giftcodeError && <span className="form-error">{giftcodeError}</span>}
                {!giftcodeError && form.giftcode && !verifyingGiftcode && (
                  <span className="form-success">✓ Mã hợp lệ</span>
                )}
                <small className="form-hint">
                  Liên hệ quản trị viên để lấy mã
                </small>
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Đang đăng ký...' : 'Tạo tài khoản'}
            </button>
          </form>

          <p className="auth-footer">
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
