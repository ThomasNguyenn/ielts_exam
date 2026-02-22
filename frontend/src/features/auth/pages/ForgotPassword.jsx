import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { Mail, ArrowLeft, Send, KeyRound, CheckCircle } from 'lucide-react';
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
            <div className="auth-container auth-container--compact">
                <div className="auth-form-panel">
                    <div className="auth-form-header">
                        <div className="auth-greeting">
                            <KeyRound size={18} /> Password Recovery
                        </div>
                        <h1>Forgot Password?</h1>
                        <p>No worries! Enter your email and we will send you a reset link.</p>
                    </div>

                    {status === 'success' ? (
                        <div className="auth-success-card">
                            <div className="auth-success-icon" style={{ background: '#E0E7FF', color: '#4F46E5' }}>
                                <Mail />
                            </div>
                            <h3>Check your email</h3>
                            <p>We've sent a password reset link to <br /><strong>{email}</strong></p>

                            <div className="auth-divider">
                                <span>Did not receive the email?</span>
                            </div>

                            <button
                                onClick={() => setStatus('idle')}
                                className="btn btn-ghost"
                                style={{ width: '100%', marginTop: '1rem', color: '#6366F1' }}
                            >
                                Try another email address
                            </button>

                            <Link to="/login" className="btn btn-ghost" style={{ marginTop: '0.5rem', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <ArrowLeft size={16} /> Back to Login
                                </div>
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="auth-field">
                                <label>Email Address</label>
                                <div className="auth-input-wrapper">
                                    <Mail className="auth-input-icon" />
                                    <input
                                        type="email"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {status === 'error' && (
                                <div className="auth-error">
                                    {message}
                                </div>
                            )}

                            <button type="submit" className="auth-submit-btn" disabled={status === 'loading'}>
                                {status === 'loading' ? 'Sending Link...' : 'Send Reset Link'}
                            </button>

                            <div className="auth-footer">
                                <Link to="/login">
                                    <ArrowLeft size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                    Back to Login
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
