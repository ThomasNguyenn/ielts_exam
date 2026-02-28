import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import LessonViewer from './LearnPhase/LessonViewer';
import CheckpointQuiz from './LearnPhase/CheckpointQuiz';

export default function LearnModuleDetail() {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const { showNotification } = useNotification();

  const [module, setModule] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const [moduleRes, progressRes] = await Promise.all([
          api.getSkillModule(moduleId),
          api.getMyProgress(),
        ]);

        if (!cancelled) {
          setModule(moduleRes?.data || null);
          setProgress(progressRes?.data || null);
        }
      } catch (error) {
        if (!cancelled) {
          showNotification(error.message || 'Failed to load module', 'error');
          navigate('/learn', { replace: true });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (moduleId) {
      loadData();
    }

    return () => {
      cancelled = true;
    };
  }, [moduleId, navigate, showNotification]);

  const isCompleted = useMemo(() => {
    if (!module?._id || !progress?.completedModules) return false;
    return progress.completedModules.some((item) => String(item.moduleId) === String(module._id));
  }, [module, progress]);

  const handleQuizComplete = async (score, passed) => {
    if (passed) {
      try {
        await api.markModuleComplete(module._id, score);
        showNotification(`Module completed! Score: ${score}%`, 'success');
        navigate('/learn');
      } catch (error) {
        showNotification(error.message || 'Failed to save progress', 'error');
      }
      return;
    }

    showNotification(`Quiz failed. Score: ${score}%. You need 70% to pass.`, 'error');
    setShowQuiz(false);
  };

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading module...</p>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="page">
        <p className="muted">Module not found.</p>
      </div>
    );
  }

  return (
    <div className="page">
      {!showQuiz ? (
        <LessonViewer
          module={module}
          onClose={() => navigate('/learn')}
          onStartQuiz={() => setShowQuiz(true)}
          isCompleted={isCompleted}
        />
      ) : (
        <CheckpointQuiz
          module={module}
          onComplete={handleQuizComplete}
          onBack={() => setShowQuiz(false)}
        />
      )}
    </div>
  );
}
