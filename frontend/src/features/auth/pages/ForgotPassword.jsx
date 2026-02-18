import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import './Auth.css';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        try {
            const res = await api.forgotPassword(email);
            setStatus('success');
            setMessage(res.message);
        } catch (err) {
            setStatus('error');
            setMessage(err.message || 'Failed to send reset email.');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-header">
                    <h1>Forgot Password</h1>
                    <p>Enter your email via which you registered.</p>
                </div>

                {status === 'success' ? (
                    <div className="auth-success-message" style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5', margin: '0 auto 1.5rem' }}>
                            <Mail size={32} />
                        </div>
                        <h3>Check your email</h3>
                        <p>{message}</p>
                        <Link to="/login" className="btn btn-ghost" style={{ marginTop: '1.5rem' }}>
                            <ArrowLeft size={16} /> Back to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label>Email Address</label>
                            <div className="input-with-icon">
                                <Mail size={18} />
                                <input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {status === 'error' && <div className="error-message">{message}</div>}

                        <button type="submit" className="btn btn-primary" disabled={status === 'loading'}>
                            {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
                            {!status === 'loading' && <Send size={18} />}
                        </button>

                        <div className="auth-footer">
                            <Link to="/login" className="back-link">
                                <ArrowLeft size={16} /> Back to Login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
