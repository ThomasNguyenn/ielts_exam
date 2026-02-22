import { useNavigate } from 'react-router-dom';
import LearnPhase from './EnhancedPracticeFlow/Phase1Learn/LearnPhase';

export default function SkillWorkshopPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <LearnPhase
        onBack={() => navigate('/')}
        onComplete={() => navigate('/practice')}
      />
    </div>
  );
}
