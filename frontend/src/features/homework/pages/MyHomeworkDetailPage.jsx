import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import {
  USER_ROLE_STUDENT_ACA,
  normalizeUserRole,
  studentAcaPath,
  studentIeltsPath,
} from "@/app/roleRouting";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import {
  DetailHeaderBar,
  DetailJourneyBoard,
  DetailStateCard,
  buildJourneyViewModel,
  buildSectionGroups,
} from "@/features/homework/components/detail";
import { formatDate } from "./homework.utils";
import { useHomeworkAssignmentDetail } from "./useHomeworkAssignmentDetail";

const PAGE_WRAPPER_CLASS =
  "min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#eefbf3_30%,_#f5f7fb_70%)] text-slate-900";
const PAGE_SHELL_CLASS = "mx-auto max-w-6xl px-4 py-6 md:px-6 lg:px-8";

export default function MyHomeworkDetailPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { showNotification } = useNotification();
  const user = api.getUser();
  const [claimingChestKeys, setClaimingChestKeys] = useState({});

  const {
    isPreviewMode,
    canAccessPage,
    loading,
    error,
    assignment,
    tasks,
    submissionsByTaskId,
    reloadAssignment,
  } = useHomeworkAssignmentDetail(assignmentId);

  const sectionGroups = useMemo(
    () => buildSectionGroups({ assignment, tasks }),
    [assignment, tasks],
  );

  const journey = useMemo(
    () =>
      buildJourneyViewModel({
        assignment,
        sectionGroups,
        submissionsByTaskId,
      }),
    [assignment, sectionGroups, submissionsByTaskId],
  );

  const isDeadlinePassed = useMemo(() => {
    const due = assignment?.due_date ? new Date(assignment.due_date) : null;
    if (!due || Number.isNaN(due.getTime())) return false;
    return Date.now() > due.getTime();
  }, [assignment?.due_date]);

  const normalizedRole = normalizeUserRole(user?.role);
  const studentHomeworkBasePath =
    normalizedRole === USER_ROLE_STUDENT_ACA ? studentAcaPath("/homework") : studentIeltsPath("/homework");
  const backToMonthPath = studentHomeworkBasePath;
  const previewQuery = isPreviewMode ? "?preview=1" : "";

  const subtitle = `Week ${assignment?.week || "--"} - Due ${formatDate(assignment?.due_date)} - ${assignment?.month || "--"}`;
  const streakLabel = `${journey.completedLessons || 0} lesson streak`;

  const renderState = (content) => (
    <div className={PAGE_WRAPPER_CLASS}>
      <div className={PAGE_SHELL_CLASS}>{content}</div>
    </div>
  );

  const openLessonByTaskId = (taskId) => {
    const normalizedTaskId = String(taskId || "").trim();
    if (!normalizedTaskId) return;
    navigate(`${studentHomeworkBasePath}/${assignmentId}/lessons/${normalizedTaskId}${previewQuery}`);
  };

  const handleOpenLesson = (node) => {
    openLessonByTaskId(node?.taskId);
  };

  const handleClaimChest = async (node) => {
    const chestKey = String(node?.chestKey || "").trim();
    if (!assignmentId || !chestKey || isPreviewMode) return;
    if (claimingChestKeys[chestKey]) return;

    setClaimingChestKeys((prev) => ({ ...prev, [chestKey]: true }));
    try {
      const response = await api.homeworkClaimChestReward(assignmentId, chestKey);
      const xpResult = response?.data?.xp_result;
      if (xpResult && typeof api.setUser === "function") {
        const currentUser = api.getUser() || {};
        api.setUser({
          ...currentUser,
          xp: xpResult.currentXP,
          level: xpResult.currentLevel,
        });
      }
      showNotification("Chest reward claimed", "success");
      await reloadAssignment();
    } catch (claimError) {
      showNotification(claimError?.message || "Cannot claim chest reward", "error");
    } finally {
      setClaimingChestKeys((prev) => {
        const next = { ...prev };
        delete next[chestKey];
        return next;
      });
    }
  };

  if (!canAccessPage) {
    return renderState(
      <DetailStateCard
        message={isPreviewMode
          ? "Preview mode is only available for teacher/admin accounts."
          : "This page is only available for student accounts."}
      />,
    );
  }

  if (loading) {
    return renderState(<DetailStateCard message="Loading assignment..." />);
  }

  if (error || !assignment) {
    return renderState(
      <DetailStateCard
        tone="danger"
        message={error || "Assignment not found"}
        actionLabel="Back"
        onAction={() => navigate(isPreviewMode ? `/homework/assignments/${assignmentId}` : backToMonthPath)}
      />,
    );
  }

  return (
    <div className={PAGE_WRAPPER_CLASS}>
      <div className={PAGE_SHELL_CLASS}>
        <div className="space-y-6">
          <DetailHeaderBar
            assignmentTitle={assignment?.title || "Assignment"}
            subtitle={subtitle}
            earnedXp={journey.earnedXp}
            streakLabel={streakLabel}
            onBack={() => navigate(backToMonthPath)}
          />

          {isPreviewMode ? (
            <DetailStateCard
              tone="warn"
              message="Preview mode: open a lesson to see student interactions. Reward claim is disabled."
            />
          ) : null}

          {isDeadlinePassed ? (
            <DetailStateCard
              tone="danger"
              message="Deadline has passed. You can still review submissions and journey states."
            />
          ) : null}

          <DetailJourneyBoard
            nodes={journey.nodes}
            progressPercent={journey.progressPercent}
            onOpenLesson={handleOpenLesson}
            onClaimChest={handleClaimChest}
            canClaimRewards={!isPreviewMode}
            claimingChestKeys={claimingChestKeys}
            reducedMotion={Boolean(reduceMotion)}
          />
        </div>
      </div>
    </div>
  );
}
