import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Save } from "lucide-react";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

const createEmptyForm = () => ({
  _id: "",
  name: "",
  description: "",
  level_label: "",
  student_ids: [],
});

export default function HomeworkGroupsPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiveId, setArchiveId] = useState("");
  const [groupToArchive, setGroupToArchive] = useState(null);
  const [error, setError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [form, setForm] = useState(createEmptyForm);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [groupRes, studentsRes] = await Promise.all([
        api.homeworkGetGroups({ include_inactive: true, limit: 100 }),
        api.getUsers({ role: "student", limit: 500, page: 1 }),
      ]);
      setGroups(Array.isArray(groupRes?.data) ? groupRes.data : []);
      setStudents(Array.isArray(studentsRes?.data) ? studentsRes.data : []);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredStudents = useMemo(() => {
    const q = String(studentSearch || "").trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (student) =>
        String(student?.name || "").toLowerCase().includes(q) ||
        String(student?.email || "").toLowerCase().includes(q),
    );
  }, [students, studentSearch]);

  const isEditing = Boolean(form._id);
  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const toggleStudent = (studentId) => {
    setForm((prev) => {
      const id = String(studentId || "");
      const selected = new Set((prev.student_ids || []).map(String));
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return {
        ...prev,
        student_ids: Array.from(selected),
      };
    });
  };

  const resetForm = () => setForm(createEmptyForm());

  const handleSave = async () => {
    if (!String(form.name || "").trim()) {
      showNotification("Group name is required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: String(form.name || "").trim(),
        description: String(form.description || "").trim(),
        level_label: String(form.level_label || "").trim(),
        student_ids: form.student_ids,
      };

      if (isEditing) {
        await api.homeworkUpdateGroup(form._id, payload);
        showNotification("Group updated", "success");
      } else {
        await api.homeworkCreateGroup(payload);
        showNotification("Group created", "success");
      }

      resetForm();
      void loadData();
    } catch (saveError) {
      showNotification(saveError?.message || "Failed to save group", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (groupId) => {
    if (!groupId) return;

    setArchiveId(String(groupId));
    try {
      await api.homeworkDeleteGroup(groupId);
      showNotification("Group archived", "success");
      if (String(form._id) === String(groupId)) resetForm();
      setGroupToArchive(null);
      void loadData();
    } catch (deleteError) {
      showNotification(deleteError?.message || "Failed to archive group", "error");
    } finally {
      setArchiveId("");
    }
  };

  const selectGroup = (group) => {
    setForm({
      _id: group?._id || "",
      name: group?.name || "",
      description: group?.description || "",
      level_label: group?.level_label || "",
      student_ids: Array.isArray(group?.student_ids)
        ? group.student_ids
            .map((studentValue) => String(studentValue?._id || studentValue?.student_id || studentValue || ""))
            .filter(Boolean)
        : [],
    });
  };

  return (
    <div className="min-h-[calc(100vh-70px)] bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight">Homework Groups</CardTitle>
              <CardDescription>Create and manage student groups used for assignment targeting.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("/homework")}>
                Back to assignments
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 xl:grid-cols-12">
          <Card className="border-border/70 shadow-sm xl:col-span-4">
            <CardHeader>
              <CardTitle>{isEditing ? "Edit Group" : "New Group"}</CardTitle>
              <CardDescription>Configure basic info and student members.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">Name</Label>
                <Input
                  id="group-name"
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                  placeholder="e.g. Grade 11 - Team A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-level">Level label</Label>
                <Input
                  id="group-level"
                  value={form.level_label}
                  onChange={(event) => updateForm({ level_label: event.target.value })}
                  placeholder="B1 / B2 / C1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-description">Description</Label>
                <Textarea
                  id="group-description"
                  value={form.description}
                  onChange={(event) => updateForm({ description: event.target.value })}
                  placeholder="Describe this group scope..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="student-search">Students ({form.student_ids.length})</Label>
                <Input
                  id="student-search"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search student by name or email"
                />
                <ScrollArea className="h-72 rounded-md border p-3">
                  <div className="space-y-2">
                    {filteredStudents.map((student) => {
                      const studentId = String(student?._id || "");
                      const checked = form.student_ids.includes(studentId);
                      return (
                        <div key={studentId} className="flex items-start gap-2 rounded-md px-1 py-1">
                          <Checkbox
                            id={`student-${studentId}`}
                            checked={checked}
                            onCheckedChange={() => toggleStudent(studentId)}
                          />
                          <Label htmlFor={`student-${studentId}`} className="cursor-pointer text-sm font-normal leading-5">
                            {student?.name || "Student"}
                            <span className="ml-1 text-muted-foreground">({student?.email || "no-email"})</span>
                          </Label>
                        </div>
                      );
                    })}
                    {!filteredStudents.length ? (
                      <p className="text-sm text-muted-foreground">No students found.</p>
                    ) : null}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : isEditing ? "Update Group" : "Create Group"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm xl:col-span-8">
            <CardHeader>
              <CardTitle>Existing Groups</CardTitle>
              <CardDescription>{groups.length} groups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? <p className="text-sm text-muted-foreground">Loading groups...</p> : null}
              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

              {!loading && !error && !groups.length ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No groups yet.
                </div>
              ) : null}

              <div className="space-y-3">
                {groups.map((group) => (
                  <Card key={group._id} className="border-border/70 shadow-none">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold">{group.name || "Untitled group"}</h3>
                          <p className="text-sm text-muted-foreground">
                            {group.level_label || "No level"} - {(group.student_ids || []).length} students
                          </p>
                        </div>
                        <Badge variant={group.is_active ? "default" : "outline"}>
                          {group.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground">{group.description || "No description"}</p>

                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => selectGroup(group)}>
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setGroupToArchive(group)}>
                          Archive
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog
        open={Boolean(groupToArchive)}
        onOpenChange={(open) => {
          if (!open) setGroupToArchive(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive group?</AlertDialogTitle>
            <AlertDialogDescription>
              This group will become inactive for future assignment targeting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(archiveId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleArchive(String(groupToArchive?._id || ""))} disabled={Boolean(archiveId)}>
              {archiveId ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
