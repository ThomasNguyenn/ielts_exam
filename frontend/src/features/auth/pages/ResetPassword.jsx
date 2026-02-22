import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { Lock, ArrowLeft, CheckCircle, KeyRound } from 'lucide-react';
import './Auth.css';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setStatus('error');
            setMessage('Passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            setStatus('error');
            setMessage('Password must be at least 6 characters');
            return;
        }

        setStatus('loading');
        setMessage('');

        try {
            const res = await api.resetPassword(token, newPassword);
            setStatus('success');
            setMessage(res.message);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setStatus('error');
            setMessage(err.message || 'Failed to reset password.');
        }
    };

    if (!token) {
        return (
            <div className="auth-page">
                <div className="auth-container auth-container--compact">
                    <div className="auth-form-panel" style={{ textAlign: 'center' }}>
                        <div className="auth-error" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
                            Invalid request. No token provided.
                        </div>
                        <Link to="/login" className="btn btn-ghost">
                            <ArrowLeft size={16} style={{ marginRight: 8 }} /> Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-container auth-container--compact">
                <div className="auth-form-panel">
                    <div className="auth-form-header">
                        <div className="auth-greeting">
                            <KeyRound size={18} /> Secure Reset
                        </div>
                        <h1>Reset Password</h1>
                        <p>Enter your new password below.</p>
                    </div>

                    {status === 'success' ? (
                        <div className="auth-success-card">
                            <div className="auth-success-icon" style={{ background: '#DEF7EC', color: '#03543F' }}>
                                <CheckCircle />
                            </div>
                            <h3>Password Reset!</h3>
                            <p>You can now login with your new password.<br />Redirecting to login...</p>

                            <Link to="/login" className="auth-submit-btn" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
                                Login Now
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="auth-field">
                                <label>New Password</label>
                                <div className="auth-input-wrapper">
                                    <Lock className="auth-input-icon" />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="auth-field">
                                <label>Confirm Password</label>
                                <div className="auth-input-wrapper">
                                    <Lock className="auth-input-icon" />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {status === 'error' && (
                                <div className="auth-error">
                                    {message}
                                </div>
                            )}

                            <button type="submit" className="auth-submit-btn" disabled={status === 'loading'}>
                                {status === 'loading' ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
