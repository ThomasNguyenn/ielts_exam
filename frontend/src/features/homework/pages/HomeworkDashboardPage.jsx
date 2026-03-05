import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { formatDate, statusLabel } from "./homework.utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function HomeworkDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskData, setTaskData] = useState({ submissions: [], not_submitted_students: [] });

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.homeworkGetAssignmentDashboard(id);
      const data = response?.data || null;
      setDashboard(data);
      const firstTaskId = data?.tasks?.[0]?.task_id || "";
      setSelectedTaskId(firstTaskId ? String(firstTaskId) : "");
    } catch (loadError) {
      setError(loadError?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadTaskSubmissions = async (taskId) => {
    if (!taskId) {
      setTaskData({ submissions: [], not_submitted_students: [] });
      return;
    }

    setTaskLoading(true);
    try {
      const response = await api.homeworkGetTaskSubmissions(id, taskId);
      setTaskData({
        submissions: Array.isArray(response?.data?.submissions) ? response.data.submissions : [],
        not_submitted_students: Array.isArray(response?.data?.not_submitted_students)
          ? response.data.not_submitted_students
          : [],
      });
    } catch (taskError) {
      setTaskData({ submissions: [], not_submitted_students: [] });
      setError(taskError?.message || "Failed to load task submissions");
    } finally {
      setTaskLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [id]);

  useEffect(() => {
    if (!selectedTaskId) return;
    void loadTaskSubmissions(selectedTaskId);
  }, [selectedTaskId]);

  const currentTask = useMemo(
    () => (dashboard?.tasks || []).find((task) => String(task?.task_id || "") === String(selectedTaskId || "")),
    [dashboard?.tasks, selectedTaskId],
  );

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-70px)] bg-muted/30">
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">Loading dashboard...</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="min-h-[calc(100vh-70px)] bg-muted/30">
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm font-medium text-destructive">{error}</p>
              <Button type="button" variant="outline" onClick={() => navigate("/homework")}>
                Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totals = dashboard?.totals || {};
  const assignment = dashboard?.assignment || {};

  return (
    <div className="min-h-[calc(100vh-70px)] bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight">Assignment Dashboard</CardTitle>
              <CardDescription>
                {assignment?.title || "Assignment"} - Week {assignment?.week || "--"} - Due {formatDate(assignment?.due_date)}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(`/homework/assignments/${id}`)}>
                View assignment
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/homework")}>
                Back
              </Button>
            </div>
          </CardHeader>
        </Card>

        {error ? (
          <Card className="border-destructive/30 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Students In Target</p>
              <p className="mt-2 text-2xl font-semibold">{totals.students_in_target || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Students In Scope</p>
              <p className="mt-2 text-2xl font-semibold">{totals.students_in_scope || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted Slots</p>
              <p className="mt-2 text-2xl font-semibold">{totals.submitted_total || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending Slots</p>
              <p className="mt-2 text-2xl font-semibold">{totals.not_submitted_total || 0}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-12">
          <Card className="border-border/70 shadow-sm xl:col-span-6">
            <CardHeader>
              <CardTitle>Task Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Not Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dashboard?.tasks || []).map((task) => {
                    const taskId = String(task?.task_id || "");
                    const isActive = taskId === String(selectedTaskId || "");
                    return (
                      <TableRow key={taskId}>
                        <TableCell>
                          <Button
                            type="button"
                            variant={isActive ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setSelectedTaskId(taskId)}
                          >
                            {task?.title || "Task"}
                          </Button>
                        </TableCell>
                        <TableCell>{task?.submitted || 0}</TableCell>
                        <TableCell>{task?.not_submitted || 0}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!(dashboard?.tasks || []).length ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No tasks in this assignment.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm xl:col-span-6">
            <CardHeader>
              <CardTitle>Students</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status Snapshot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dashboard?.students || []).map((student) => {
                    const submittedCount = (student?.tasks || []).filter((task) => task.submitted).length;
                    return (
                      <TableRow key={student?._id || student?.email || student?.name}>
                        <TableCell>{student?.name || "Student"}</TableCell>
                        <TableCell className="text-muted-foreground">{student?.email || "--"}</TableCell>
                        <TableCell>
                          {submittedCount}/{(student?.tasks || []).length || 0} submitted
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!(dashboard?.students || []).length ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No students in scope.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle>Task Drilldown</CardTitle>
              <CardDescription>{currentTask ? currentTask.title : "Select a task to inspect submissions."}</CardDescription>
            </div>
            <Badge variant={currentTask ? "default" : "outline"}>{currentTask ? "Task selected" : "No task"}</Badge>
          </CardHeader>

          <CardContent className="space-y-4">
            {taskLoading ? <p className="text-sm text-muted-foreground">Loading task submissions...</p> : null}

            {!taskLoading && selectedTaskId ? (
              <div className="grid gap-6 xl:grid-cols-12">
                <div className="xl:col-span-8">
                  <Card className="border-border/70 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Submitted</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Submitted At</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(taskData.submissions || []).map((submission) => (
                            <TableRow key={submission?._id}>
                              <TableCell>{submission?.student?.name || submission?.student_id || "--"}</TableCell>
                              <TableCell>{statusLabel(submission?.status)}</TableCell>
                              <TableCell>{submission?.score ?? "--"}</TableCell>
                              <TableCell>{formatDate(submission?.submitted_at)}</TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/homework/submissions/${submission._id}`)}
                                >
                                  Grade
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {!taskData.submissions.length ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-muted-foreground">
                                No submissions yet.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                <div className="xl:col-span-4">
                  <Card className="border-border/70 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Not Submitted</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(taskData.not_submitted_students || []).map((student) => (
                        <div key={student?._id || student?.email || student?.name} className="rounded-md border px-3 py-2">
                          <p className="text-sm font-medium">{student?.name || "Student"}</p>
                          <p className="text-xs text-muted-foreground">{student?.email || "--"}</p>
                        </div>
                      ))}
                      {!taskData.not_submitted_students.length ? (
                        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                          Everyone submitted for this task.
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}

            {!taskLoading && !selectedTaskId ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Select a task to view submissions.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
