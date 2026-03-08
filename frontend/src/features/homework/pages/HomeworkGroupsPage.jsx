import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Save, X, Plus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search } from "lucide-react";


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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [knownStudentsMap, setKnownStudentsMap] = useState({});
  const [form, setForm] = useState(createEmptyForm);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkMatchResults, setBulkMatchResults] = useState({ matched: [], ambiguous: [], notFound: [] });

  const normalizeLookupValue = (val) => String(val || "").trim().toLowerCase();


  const handleBulkMatch = async () => {
    if (!bulkText.trim()) {
      showNotification("Please enter names or emails", "error");
      return;
    }

    try {
      const res = await api.getUsers({ role: "student", limit: 1000 });
      const allStudents = Array.isArray(res?.data) ? res.data : [];

      const lines = bulkText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const matched = [];
      const ambiguous = [];
      const notFound = [];
      const matchedIds = new Set();

      lines.forEach(line => {
        const query = normalizeLookupValue(line);
        const matches = allStudents.filter(s =>
          normalizeLookupValue(s.name) === query ||
          normalizeLookupValue(s.email) === query
        );

        if (matches.length === 1) {
          matched.push(`${line} -> ${matches[0].name}`);
          matchedIds.add(String(matches[0]._id));
          setKnownStudentsMap(prev => ({ ...prev, [String(matches[0]._id)]: matches[0] }));
        } else if (matches.length > 1) {
          ambiguous.push(`${line} (${matches.length} matches)`);
        } else {
          notFound.push(line);
        }
      });

      setBulkMatchResults({ matched, ambiguous, notFound });

      if (matchedIds.size > 0) {
        setForm(prev => ({
          ...prev,
          student_ids: Array.from(new Set([...prev.student_ids, ...Array.from(matchedIds)]))
        }));
        showNotification(`Added ${matchedIds.size} students from bulk list`, "success");
      }
    } catch (err) {
      showNotification("Failed to process bulk import", "error");
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const groupRes = await api.homeworkGetGroups({ include_inactive: true, limit: 100 });
      const nextGroups = Array.isArray(groupRes?.data) ? groupRes.data : [];
      setGroups(nextGroups);
      setKnownStudentsMap((prev) => {
        const next = { ...prev };
        nextGroups.forEach((group) => {
          (Array.isArray(group?.student_ids) ? group.student_ids : []).forEach((studentValue) => {
            if (studentValue && typeof studentValue === "object" && studentValue._id) {
              next[String(studentValue._id)] = studentValue;
            }
          });
        });
        return next;
      });
    } catch (loadError) {
      setError(loadError?.message || "Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(studentSearch);
    }, 500);
    return () => clearTimeout(handler);
  }, [studentSearch]);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const studentsRes = await api.getUsers({ role: "student", limit: 50, page: 1, search: debouncedSearch });
        const newStudents = Array.isArray(studentsRes?.data) ? studentsRes.data : [];
        setStudents(newStudents);
        setKnownStudentsMap(prev => {
          const next = { ...prev };
          newStudents.forEach(s => {
            if (s && s._id) {
              next[String(s._id)] = s;
            }
          });
          return next;
        });
      } catch (err) {
        console.error("Failed to load students for search", err);
      }
    };
    fetchStudents();
  }, [debouncedSearch]);

  // Instead of filteredStudents, we just use the API result `students`
  const filteredStudents = students;

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
    const parsedIds = Array.isArray(group?.student_ids)
      ? group.student_ids
        .map((studentValue) => {
          // Incase backend populates students, handle grabbing ID and storing the object
          const isObj = studentValue && typeof studentValue === 'object' && studentValue._id;
          if (isObj) {
            setKnownStudentsMap(prev => ({ ...prev, [String(studentValue._id)]: studentValue }));
          }
          return String(studentValue?._id || studentValue?.student_id || studentValue || "");
        })
        .filter(Boolean)
      : [];
    setForm({
      _id: group?._id || "",
      name: group?.name || "",
      description: group?.description || "",
      level_label: group?.level_label || "",
      student_ids: parsedIds,
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
          <Card className="border-border/70 shadow-sm xl:col-span-8">
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

              <div className="space-y-4 rounded-md border p-4 bg-muted/10">
                <div className="space-y-2">
                  <Label>Current Members ({form.student_ids.length})</Label>
                  <ScrollArea className="h-40 rounded-md border bg-background p-2">
                    <div className="space-y-2">
                      {form.student_ids.map((id) => {
                        const studentObj = knownStudentsMap[id];
                        return (
                          <div key={`current-${id}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm shadow-sm">
                            <div className="flex flex-col">
                              <span className="font-medium">{studentObj?.name || "Unknown"}</span>
                              <span className="text-xs text-muted-foreground">{studentObj?.email || id}</span>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => toggleStudent(id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                      {form.student_ids.length === 0 && (
                        <p className="text-sm text-muted-foreground pt-2 text-center">No students added yet.</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="student-search">Add Students</Label>
                  <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-primary">
                        Bulk Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Bulk Student Import</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Paste student names or emails (one per line)</Label>
                          <Textarea
                            placeholder="Nguyen Van A&#10;student@gmail.com"
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            rows={6}
                          />
                        </div>
                        <Button type="button" onClick={handleBulkMatch} className="w-full">
                          Find & Add to Group
                        </Button>

                        {bulkMatchResults.matched.length > 0 && (
                          <div className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-700 border border-emerald-100">
                            <p className="font-semibold">Matched ({bulkMatchResults.matched.length}):</p>
                            <ul className="list-disc list-inside">
                              {bulkMatchResults.matched.slice(0, 5).map((m, i) => <li key={i}>{m}</li>)}
                              {bulkMatchResults.matched.length > 5 && <li>...and {bulkMatchResults.matched.length - 5} more</li>}
                            </ul>
                          </div>
                        )}

                        {bulkMatchResults.notFound.length > 0 && (
                          <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700 border border-rose-100">
                            <p className="font-semibold">Not Found ({bulkMatchResults.notFound.length}):</p>
                            <p>{bulkMatchResults.notFound.join(", ")}</p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="student-search"
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Search available students..."
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="h-48 rounded-md border bg-background p-2">
                  <div className="space-y-2">
                    {filteredStudents
                      .filter(s => !form.student_ids.includes(String(s._id)))
                      .slice(0, 50) // limit to 50 to avoid rendering huge lists
                      .map((student) => {
                        const studentId = String(student?._id || "");
                        return (
                          <div key={`add-${studentId}`} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50">
                            <div className="flex flex-col overflow-hidden">
                              <span className="font-medium text-sm truncate">{student?.name || "Student"}</span>
                              <span className="text-xs text-muted-foreground truncate">{student?.email || "no-email"}</span>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => toggleStudent(studentId)}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    {!filteredStudents.filter(s => !form.student_ids.includes(String(s._id))).length ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No new students found.</p>
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

          <Card className="border-border/70 shadow-sm xl:col-span-4">
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

                      {group.student_ids && group.student_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {group.student_ids.slice(0, 5).map((studentValue, index) => {
                            const studentId = String(
                              studentValue?._id || studentValue?.student_id || studentValue || "",
                            );
                            const studentObj =
                              (studentValue && typeof studentValue === "object" ? studentValue : null)
                              || knownStudentsMap[studentId];
                            return (
                              <Badge
                                key={`badge-${group._id}-${studentId || index}`}
                                variant="secondary"
                                className="font-normal text-xs px-2 py-0.5"
                              >
                                {studentObj?.name || studentId || "Student"}
                              </Badge>
                            );
                          })}
                          {group.student_ids.length > 5 && (
                            <Badge variant="outline" className="font-normal text-xs px-2 py-0.5 text-muted-foreground">
                              +{group.student_ids.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
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
    </div >
  );
}
