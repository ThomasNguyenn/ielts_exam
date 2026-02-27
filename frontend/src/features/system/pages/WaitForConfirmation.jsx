import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import './WaitForConfirmation.css';

export default function WaitForConfirmation() {
  const navigate = useNavigate();
  const user = api.getUser();
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState('');

  useEffect(() => {
    if (!user?.isConfirmed) return undefined;

    const timeoutId = setTimeout(() => {
      navigate('/');
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [navigate, user?.isConfirmed]);

  const handleLogout = async () => {
    await api.logout();
    navigate('/login', { replace: true });
  };

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setCheckError('');

    try {
      const res = await api.getProfile();
      const latestUser = res?.data?.user || res?.data;

      if (!latestUser) {
        throw new Error('Không thể lấy thông tin tài khoản');
      }

      api.setUser(latestUser);

      if (latestUser.isConfirmed) {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setCheckError(err.message || 'Không thể kiểm tra trạng thái. Vui lòng thử lại.');
    } finally {
      setIsChecking(false);
    }
  };

  if (user?.isConfirmed) {
      return (
          <div className="wait-confirmation-container">
              <div className="wait-card success-state">
                  <div className="status-icon-wrapper">
                    <svg className="status-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="wait-title">Tài khoản được xác nhận!</h2>
                  <p className="wait-message" style={{ marginBottom: 0 }}>
                      Đang chuyển hướng bạn đến trang quản trị...
                  </p>
              </div>
          </div>
      )
  }

  return (
    <div className="wait-confirmation-container">
      <div className="wait-card">
        <div className="status-icon-wrapper">
            <svg className="status-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>

        <h2 className="wait-title">Đăng ký thành công</h2>
        
        <div className="wait-message">
          Cảm ơn bạn đã đăng ký, <span className="user-name">{user?.name}</span>!<br/>
          Tài khoản của bạn hiện đang chờ được phê duyệt.<br/>
          Vui lòng đợi giáo viên xác nhận việc đăng ký của bạn.
        </div>

        <div className="action-buttons">
          <button onClick={handleCheckStatus} className="refresh-btn" disabled={isChecking}>
            {isChecking ? (
                <>
                    <svg className="animate-spin" style={{width: '20px', height: '20px'}} fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Kiểm tra...
                </>
            ) : (
                <>
                    <svg style={{width: '20px', height: '20px'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Đã được xác nhận (Refresh)
                </>
            )}
          </button>
          
          <button onClick={handleLogout} className="logout-btn">
            Đăng xuất
          </button>
        </div>
        
        {checkError ? (
          <p className="support-text" style={{ marginTop: '1rem', color: '#d32f2f' }}>
            {checkError}
          </p>
        ) : null}
        <p className="support-text">
            Nếu bạn tin rằng đây là một lỗi, vui lòng liên hệ với quản trị viên của bạn.
        </p>
      </div>
    </div>
  );
}
