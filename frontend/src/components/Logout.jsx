import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Logout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    api.removeToken();
    api.removeUser();
    navigate('/login');
  };

  return (
    <button className="btn btn-ghost" onClick={handleLogout}>
      Logout
    </button>
  );
}
