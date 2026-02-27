import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '@/shared/api/client';

export default function Logout() {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await api.logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <button className="btn btn-ghost" onClick={handleLogout} disabled={isLoggingOut}>
      Logout
    </button>
  );
}
