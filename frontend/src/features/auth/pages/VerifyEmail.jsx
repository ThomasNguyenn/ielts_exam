import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { Check, X, ArrowLeft, Loader } from 'lucide-react';
import './Auth.css';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading'); // loading, success, error
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('No verification token provided.');
            return;
        }

        api.verifyEmail(token)
            .then(() => {
                setStatus('success');
            })
            .catch(err => {
                setStatus('error');
                setMessage(err.message || 'Verification failed. The token may be invalid or expired.');
            });
    }, [token]);

    return (
        <div className="auth-page">
            <div className="auth-container" style={{ textAlign: 'center' }}>
                <div className="auth-header">
                    <h1>Email Verification</h1>
                </div>

                <div className="auth-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2rem 0' }}>
                    {status === 'loading' && (
                        <>
                            <Loader className="spin" size={48} color="#6366F1" />
                            <p>Verifying your email...</p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#DEF7EC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#03543F' }}>
                                <Check size={32} />
                            </div>
                            <h3>Email Verified!</h3>
                            <p>Your email has been successfully verified. You can now access all features.</p>
                            <Link to="/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                                Go to Login
                            </Link>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FDE8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9B1C1C' }}>
                                <X size={32} />
                            </div>
                            <h3>Verification Failed</h3>
                            <p>{message}</p>
                            <Link to="/login" className="btn btn-ghost" style={{ marginTop: '1rem' }}>
                                <ArrowLeft size={16} /> Back to Login
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
