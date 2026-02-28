import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import './GradingInterface.css';

export default function GradingInterface() {
  const { showNotification } = useNotification();
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grades, setGrades] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const res = await api.getSubmissionById(id);
        if (res?.success && res?.data) {
          setSubmission(res.data);
          const initialGrades = {};
          (res.data.writing_answers || []).forEach((answer) => {
            const existingScore = (res.data.scores || []).find((score) => score.task_id === answer.task_id);
            initialGrades[answer.task_id] = {
              score: existingScore?.score ?? '',
              feedback: existingScore?.feedback || '',
            };
          });
          setGrades(initialGrades);
        }
      } catch {
        setError('Failed to load submission');
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [id]);

  const handleGradeChange = (taskId, field, value) => {
    setGrades((previous) => ({
      ...previous,
      [taskId]: {
        ...previous[taskId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!submission) return;

    setSubmitting(true);
    const scoresPayload = (submission.writing_answers || []).map((answer) => ({
      task_id: answer.task_id,
      score: Number.parseFloat(grades[answer.task_id]?.score || 0),
      feedback: grades[answer.task_id]?.feedback || '',
    }));

    try {
      const res = await api.scoreSubmission(id, { scores: scoresPayload });
      if (res) {
        showNotification('Grading submitted successfully!', 'success');
        navigate('/grading');
      }
    } catch (submitError) {
      console.error(submitError);
      showNotification('Failed to submit grading', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="grading-interface grading-interface--center">
        <p className="grading-interface__muted">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grading-interface grading-interface--center">
        <p className="grading-interface__error">{error}</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="grading-interface grading-interface--center">
        <p className="grading-interface__muted">Submission not found</p>
      </div>
    );
  }

  return (
    <div className="grading-interface">
      <div className="grading-interface__container">
        <button type="button" onClick={() => navigate('/grading')} className="grading-interface__back-btn">
          <ArrowLeft size={16} />
          <span>Back to grading list</span>
        </button>

        <header className="grading-interface__header">
          <h1>Evaluate Submission</h1>
          <p>
            Student: <strong>{submission.student_name || 'Anonymous'}</strong>
            <span className="grading-interface__separator">|</span>
            Submitted: {new Date(submission.submitted_at).toLocaleString()}
          </p>
          {submission.score !== undefined && submission.score !== null && (
            <div className="grading-interface__overall-band">Overall Band: {submission.score}</div>
          )}
        </header>

        <form onSubmit={handleSubmit} className="grading-interface__form">
          {(submission.writing_answers || []).map((answer, index) => (
            <section key={answer.task_id || index} className="grading-interface__task-block">
              <div className="grading-interface__task-head">
                <h2>{answer.task_title || `Task ${index + 1}`}</h2>
                <span>{answer.word_count || 0} words</span>
              </div>

              {(answer.task_prompt || answer.task_image) && (
                <div className="grading-interface__prompt-card">
                  {answer.task_image && (
                    <div className="grading-interface__task-image-wrap">
                      <h3>Task Image / Chart</h3>
                      <img src={answer.task_image} alt="Task visual" className="grading-interface__task-image" />
                    </div>
                  )}
                  {answer.task_prompt && (
                    <div>
                      <h3>Task Prompt</h3>
                      <p className="grading-interface__prompt-text">{answer.task_prompt}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grading-interface__answer-card">
                <h3>Student Answer</h3>
                <p>{answer.answer_text}</p>
              </div>

              <div className="grading-interface__grading-box">
                <h3>Score {answer.task_title || `Task ${index + 1}`}</h3>

                <label className="grading-interface__field">
                  <span>Band Score (0-9)</span>
                  <input
                    type="number"
                    min="0"
                    max="9"
                    step="0.5"
                    value={grades[answer.task_id]?.score || ''}
                    onChange={(event) => handleGradeChange(answer.task_id, 'score', event.target.value)}
                    required
                  />
                </label>

                <label className="grading-interface__field">
                  <span>Feedback</span>
                  <textarea
                    rows="5"
                    value={grades[answer.task_id]?.feedback || ''}
                    onChange={(event) => handleGradeChange(answer.task_id, 'feedback', event.target.value)}
                    placeholder="Write detailed feedback for the student..."
                  />
                </label>
              </div>
            </section>
          ))}

          <div className="grading-interface__actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Final Grading'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
