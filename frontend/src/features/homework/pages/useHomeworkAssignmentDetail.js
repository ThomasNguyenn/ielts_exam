import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { buildPreviewAssignmentFromManageData, sortTasksByOrder } from "./myHomeworkStudentUtils";

export const useHomeworkAssignmentDetail = (assignmentId) => {
  const [searchParams] = useSearchParams();
  const user = api.getUser();

  const isPreviewMode = searchParams.get("preview") === "1";
  const isManageUser = user?.role === "teacher" || user?.role === "admin";
  const canAccessPage = isPreviewMode ? isManageUser : user?.role === "student";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignment, setAssignment] = useState(null);

  const reloadAssignment = useCallback(async () => {
    if (!assignmentId || !canAccessPage) return;
    setLoading(true);
    setError("");
    try {
      const response = isPreviewMode
        ? await api.homeworkGetAssignmentById(assignmentId)
        : await api.homeworkGetMyAssignmentById(assignmentId);
      const data = isPreviewMode
        ? buildPreviewAssignmentFromManageData(response?.data || {})
        : response?.data || null;
      setAssignment(data);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load assignment detail");
      setAssignment(null);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, canAccessPage, isPreviewMode]);

  useEffect(() => {
    if (!canAccessPage) {
      setLoading(false);
      return;
    }
    void reloadAssignment();
  }, [canAccessPage, reloadAssignment]);

  const tasks = useMemo(() => sortTasksByOrder(assignment?.tasks), [assignment?.tasks]);

  const submissionsByTaskId = useMemo(() => {
    const map = new Map();
    (assignment?.submissions || []).forEach((submission) => {
      map.set(String(submission.task_id || ""), submission);
    });
    return map;
  }, [assignment?.submissions]);

  return {
    user,
    isPreviewMode,
    canAccessPage,
    loading,
    error,
    assignment,
    tasks,
    submissionsByTaskId,
    reloadAssignment,
  };
};
