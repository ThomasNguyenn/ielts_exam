import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import {
  Sparkles, User, Mail, Lock,
  BookOpen, Check, AlertCircle
} from 'lucide-react';
import './Auth.css';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Invite state
  const [inviteData, setInviteData] = useState(null); // { email, role }
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  // Validate invite token on mount
  useEffect(() => {
    if (!inviteToken) return;

    setInviteLoading(true);
    setInviteError(null);

    api.validateInvitation(inviteToken)
      .then((res) => {
        const data = res?.data || res;
        if (data?.valid) {
          setInviteData({ email: data.data?.email || data.email, role: data.data?.role || data.role });
          setForm((prev) => ({ ...prev, email: data.data?.email || data.email || '' }));
        } else {
          setInviteError('Lời mời không hợp lệ hoặc đã hết hạn');
        }
      })
      .catch(() => {
        setInviteError('Lời mời không hợp lệ hoặc đã hết hạn');
      })
      .finally(() => setInviteLoading(false));
  }, [inviteToken]);

  const roleLabel = inviteData?.role === 'admin' ? 'Quản trị viên' : inviteData?.role === 'teacher' ? 'Giáo viên' : 'Học sinh';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu không khớp');
      return;
    }

    if (form.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    setLoading(true);

    try {
      const registerData = {
        name: form.name,
        email: form.email,
        password: form.password,
      };

      if (inviteToken) {
        registerData.inviteToken = inviteToken;
      }

      const res = await api.register(registerData);

      api.setToken(res.data.token);
      api.setUser(res.data.user);

      if (!res.data.user.isConfirmed && res.data.user.role === 'student') {
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
              <span className="auth-brand-logo-text">IELTS Pro</span>
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

          {inviteLoading && (
            <div className="auth-info" style={{ padding: '12px', background: 'var(--surface-2, #f0f4ff)', borderRadius: 8, marginBottom: 16 }}>
              Đang xác minh lời mời...
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
              <strong>🎉 Bạn được mời với vai trò: {roleLabel}</strong>
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
              <div className="auth-field">
                <label>Mật khẩu</label>
                <div className="auth-input-wrapper">
                  <Lock className="auth-input-icon" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Ít nhất 8 ký tự"
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

            <button type="submit" className="auth-submit-btn" disabled={loading || inviteLoading || !!inviteError}>
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
