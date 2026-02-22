import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { Sparkles, Mail, Lock, BookOpen, Check, AlertCircle } from 'lucide-react';
import './Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.login(form);
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
              Luyện thi IELTS hiệu quả cùng AI
            </h2>
            <p className="auth-brand-desc">
              Nền tảng luyện thi thông minh giúp bạn đạt band điểm mong muốn với phương pháp học cá nhân hóa.
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
                Theo dõi tiến trình học tập
              </li>
            </ul>
          </div>
        </div>

        {/* Right — Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-form-header">
            <div className="auth-greeting">
              <Sparkles /> Chào mừng trở lại
            </div>
            <h1>Đăng nhập</h1>
            <p>Nhập thông tin để tiếp tục hành trình IELTS của bạn</p>
          </div>

          {error && (
            <div className="auth-error">
              <AlertCircle />
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
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

            <div className="auth-field">
              <label>Mật khẩu</label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Nhập mật khẩu"
                  required
                />
              </div>
              <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: '#6366F1' }}>
                  Quên mật khẩu?
                </Link>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <p className="auth-footer">
            Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
