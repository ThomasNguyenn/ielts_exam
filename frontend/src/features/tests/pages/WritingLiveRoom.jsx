import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import WritingLiveRoomTeacherView from './writing-live/WritingLiveRoomTeacherView';
import WritingLiveRoomStudentView from './writing-live/WritingLiveRoomStudentView';
import {
  normalizeRoomCode,
  useWritingLiveRoomSession,
} from './writing-live/useWritingLiveRoomSession';
import './writing-live/writingLiveRoom.ui.css';

export default function WritingLiveRoom() {
  const { roomCode: rawRoomCode } = useParams();
  const roomCode = normalizeRoomCode(rawRoomCode);
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const user = api.getUser() || {};
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  const roomEndRedirectPath = isTeacher ? '/grading' : '/profile';

  const handleRoomClosed = useCallback(() => {
    showNotification('Writing live room has been closed.', 'info');
    navigate(roomEndRedirectPath, { replace: true });
  }, [showNotification, navigate, roomEndRedirectPath]);

  const session = useWritingLiveRoomSession({
    roomCode,
    isTeacher,
    onRoomClosed: handleRoomClosed,
  });

  const handleFinishAndGrade = useCallback(async () => {
    try {
      await session.endRoom();
      showNotification('Writing live room has been closed.', 'info');
      navigate('/grading', { replace: true });
    } catch (error) {
      session.setStatus(error?.message || 'Failed to close live room.');
    }
  }, [session, showNotification, navigate]);

  const handleLeaveRoom = useCallback(async () => {
    if (isTeacher) {
      try {
        await session.closeRoomByTeacher();
      } catch {
        // Continue navigation even if close fails.
      }
    }
    navigate(roomEndRedirectPath);
  }, [isTeacher, session, navigate, roomEndRedirectPath]);

  if (session.loading) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Loading live room...</p>
      </div>
    );
  }

  if (session.error) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-red-600">{session.error}</p>
        <button
          type="button"
          className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          onClick={() => navigate('/writing-live/join')}
        >
          Back to join
        </button>
      </div>
    );
  }

  if (!session.submission) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Submission not found.</p>
      </div>
    );
  }

  if (isTeacher) {
    return (
      <WritingLiveRoomTeacherView
        roomCode={roomCode}
        session={session}
        onLeaveRoom={handleLeaveRoom}
        onFinishAndGrade={handleFinishAndGrade}
      />
    );
  }

  return (
    <WritingLiveRoomStudentView
      roomCode={roomCode}
      session={session}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}

