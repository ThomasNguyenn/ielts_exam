import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  normalizeUserRole,
  USER_ROLE_ADMIN,
  USER_ROLE_SUPERVISOR,
  USER_ROLE_TEACHER,
} from "@/app/roleRouting";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { formatDate, statusLabel, toMonthValue } from "./homework.utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_OPTIONS = ["all", "draft", "published", "archived"];
const OWNER_OPTIONS = ["all", "me"];

export default function HomeworkAssignmentsPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const user = api.getUser();
  const normalizedRole = normalizeUserRole(user?.role);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [deletingAssignment, setDeletingAssignment] = useState(null);
  const [filters, setFilters] = useState({
    month: toMonthValue(),
    status: "all",
    owner: normalizedRole === USER_ROLE_TEACHER || normalizedRole === USER_ROLE_SUPERVISOR ? "me" : "all",
    page: 1,
  });

  const loadAssignments = async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page: nextFilters.page || 1,
        limit: 20,
      };
      if (nextFilters.month) params.month = nextFilters.month;
      if (nextFilters.status && nextFilters.status !== "all") params.status = nextFilters.status;
      if (nextFilters.owner && nextFilters.owner !== "all") params.owner = nextFilters.owner;

      const response = await api.homeworkGetAssignments(params);
      setItems(Array.isArray(response?.data) ? response.data : []);
      setPagination(response?.pagination || { page: 1, limit: 20, totalItems: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError?.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssignments(filters);
  }, []);

  const updateFilters = (patch) => {
    const next = { ...filters, ...patch, page: 1 };
    setFilters(next);
    void loadAssignments(next);
  };

  const handleDelete = async (assignmentId) => {
    if (!assignmentId) return;

    setDeletingId(String(assignmentId));
    try {
      await api.homeworkDeleteAssignment(assignmentId);
      showNotification("Assignment deleted", "success");
      setDeletingAssignment(null);
      void loadAssignments(filters);
    } catch (deleteError) {
      showNotification(deleteError?.message || "Failed to delete assignment", "error");
    } finally {
      setDeletingId("");
    }
  };

  const canCreate = [USER_ROLE_ADMIN, USER_ROLE_SUPERVISOR, USER_ROLE_TEACHER].includes(normalizedRole);
  const statusVariant = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "published") return "default";
    if (normalized === "archived") return "outline";
    return "secondary";
  };

  const assignmentCountLabel = useMemo(() => {
    const total = Number(pagination?.totalItems || items.length || 0);
    return `${total} assignment${total === 1 ? "" : "s"}`;
  }, [items.length, pagination?.totalItems]);

  return (
    <div className="min-h-[calc(100vh-70px)] bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight">Homework Assignments</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("/homework/groups")}>
                <FolderKanban className="h-4 w-4" />
                Manage groups
              </Button>
              {canCreate ? (
                <Button type="button" onClick={() => navigate("/homework/assignments/new")}>
                  <Plus className="h-4 w-4" />
                  New assignment
                </Button>
              ) : null}
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="assignment-month">Month</Label>
                <Input
                  id="assignment-month"
                  type="month"
                  value={filters.month || ""}
                  onChange={(event) => updateFilters({ month: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(value) => updateFilters({ status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "all" ? "All" : statusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={filters.owner} onValueChange={(value) => updateFilters({ owner: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNER_OPTIONS.map((owner) => (
                      <SelectItem key={owner} value={owner}>
                        {owner === "all" ? "All" : "My assignments"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={() => void loadAssignments(filters)} className="w-full">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Assignments</CardTitle>
            <CardDescription>{assignmentCountLabel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading assignments...</p> : null}
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

            {!loading && !error && items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No assignments found for current filters.
              </div>
            ) : null}

            <div className="space-y-3">
              {items.map((assignment) => (
                <Card key={assignment._id} className="border-border/70 shadow-none">
                  <CardContent className="space-y-4 px-4 pb-4 pt-3">
                    <div className="flex flex-nowrap items-center justify-between gap-3">
                      <h3 className="m-0 min-w-0 flex-1 truncate text-base font-semibold">
                        {assignment.title || "Untitled assignment"}
                      </h3>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={statusVariant(assignment.status)}>{statusLabel(assignment.status)}</Badge>
                        <Badge variant="outline">{assignment.month || "--"}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Week {assignment.week || "--"} - Due {formatDate(assignment.due_date)}
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => navigate(`/homework/assignments/${assignment._id}`)}>
                        {assignment.can_manage ? "Edit" : "View"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/homework/assignments/${assignment._id}/dashboard`)}
                      >
                        Dashboard
                      </Button>
                      {assignment.can_manage ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeletingAssignment(assignment)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={Boolean(deletingAssignment)}
        onOpenChange={(open) => {
          if (!open) setDeletingAssignment(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This assignment and all linked submissions will be deleted permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete(String(deletingAssignment?._id || ""))} disabled={Boolean(deletingId)}>
              {deletingId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
