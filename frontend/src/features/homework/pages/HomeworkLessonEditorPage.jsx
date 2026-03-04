import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Upload } from "lucide-react";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import "./Homework.css";

const createLessonForm = () => ({
  name: "",
  type: "custom_task",
  instruction: "",
  due_date: "",
  is_published: false,
  resource_mode: "internal",
  resource_ref_type: "passage",
  resource_ref_id: "",
  resource_url: "",
  resource_storage_key: "",
  requires_text: true,
  requires_image: false,
  requires_audio: false,
  min_words: "",
  max_words: "",
});

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function HomeworkLessonEditorPage() {
  const { id, lessonId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const uploadInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [assignment, setAssignment] = useState(null);
  const [section, setSection] = useState(null);
  const [lesson, setLesson] = useState(createLessonForm);
  const [catalog, setCatalog] = useState({
    passage: [],
    section: [],
    speaking: [],
    writing: [],
  });
  const [searchKeyword, setSearchKeyword] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [lessonRes, passageRes, sectionRes, speakingRes, writingRes] = await Promise.all([
        api.homeworkGetAssignmentLessonById(id, lessonId),
        api.getPassages(),
        api.getSections(),
        api.getSpeakings({ limit: 200 }),
        api.getWritings(),
      ]);

      const payload = lessonRes?.data || {};
      const nextLesson = payload.lesson || {};
      setAssignment(payload.assignment || null);
      setSection(payload.section || null);
      setLesson({
        ...createLessonForm(),
        ...nextLesson,
        name: nextLesson?.name || "",
        type: nextLesson?.type || "custom_task",
        instruction: nextLesson?.instruction || "",
        due_date: toDateInputValue(nextLesson?.due_date),
        is_published: Boolean(nextLesson?.is_published),
        resource_mode: nextLesson?.resource_mode || "internal",
        resource_ref_type: nextLesson?.resource_ref_type || "passage",
        resource_ref_id: nextLesson?.resource_ref_id || "",
        resource_url: nextLesson?.resource_url || "",
        resource_storage_key: nextLesson?.resource_storage_key || "",
        requires_text: Boolean(nextLesson?.requires_text),
        requires_image: Boolean(nextLesson?.requires_image),
        requires_audio: Boolean(nextLesson?.requires_audio),
        min_words: nextLesson?.min_words ?? "",
        max_words: nextLesson?.max_words ?? "",
      });
      setCatalog({
        passage: Array.isArray(passageRes?.data) ? passageRes.data : [],
        section: Array.isArray(sectionRes?.data) ? sectionRes.data : [],
        speaking: Array.isArray(speakingRes?.data) ? speakingRes.data : [],
        writing: Array.isArray(writingRes?.data) ? writingRes.data : [],
      });
    } catch (loadError) {
      setError(loadError?.message || "Failed to load lesson");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id, lessonId]);

  const updateLesson = (patch) => setLesson((prev) => ({ ...prev, ...patch }));

  const currentResources = useMemo(() => {
    const list = catalog[String(lesson.resource_ref_type || "passage")] || [];
    const keyword = String(searchKeyword || "").trim().toLowerCase();
    if (!keyword) return list.slice(0, 40);
    return list
      .filter((item) =>
        `${item?.title || ""} ${item?._id || ""}`.toLowerCase().includes(keyword),
      )
      .slice(0, 40);
  }, [catalog, lesson.resource_ref_type, searchKeyword]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: String(lesson.name || "").trim(),
        type: String(lesson.type || "").trim(),
        instruction: String(lesson.instruction || ""),
        due_date: String(lesson.due_date || "").trim() || null,
        is_published: Boolean(lesson.is_published),
        resource_mode: lesson.resource_mode,
        resource_ref_type: lesson.resource_mode === "internal" ? lesson.resource_ref_type : null,
        resource_ref_id: lesson.resource_mode === "internal" ? lesson.resource_ref_id : null,
        resource_url:
          lesson.resource_mode === "internal" ? null : String(lesson.resource_url || "").trim() || null,
        resource_storage_key:
          lesson.resource_mode === "uploaded"
            ? String(lesson.resource_storage_key || "").trim() || null
            : null,
        requires_text: Boolean(lesson.requires_text),
        requires_image: Boolean(lesson.requires_image),
        requires_audio: Boolean(lesson.requires_audio),
        min_words: lesson.min_words === "" ? null : Number(lesson.min_words),
        max_words: lesson.max_words === "" ? null : Number(lesson.max_words),
      };

      await api.homeworkPatchAssignmentLessonById(id, lessonId, payload);
      showNotification("Lesson updated", "success");
      await load();
    } catch (saveError) {
      showNotification(saveError?.message || "Failed to save lesson", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadClick = () => {
    uploadInputRef.current?.click?.();
  };

  const handleUploadSelected = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("resource", file);
      formData.append("assignment_id", id || "");
      formData.append("task_id", lessonId || "");
      const response = await api.uploadHomeworkResource(formData);
      updateLesson({
        resource_mode: "uploaded",
        resource_url: response?.data?.url || "",
        resource_storage_key: response?.data?.key || "",
      });
      showNotification("Resource uploaded", "success");
    } catch (uploadError) {
      showNotification(uploadError?.message || "Failed to upload resource", "error");
    } finally {
      setUploading(false);
      if (event?.target) event.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <Card>
            <CardContent className="pt-6">Loading lesson...</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <p className="homework-danger">{error}</p>
              <Button variant="outline" onClick={() => navigate(`/homework/assignments/${id}`)}>
                Back to Assignment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="homework-page">
      <div className="homework-shell">
        <Card className="sticky top-3 z-[4]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Lesson Editor</CardTitle>
              <CardDescription>
                {assignment?.title || "Assignment"} / {section?.name || "Section"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link to={`/homework/assignments/${id}`}>
                  <ArrowLeft className="h-4 w-4" />
                  Assignment
                </Link>
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Lesson"}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 lg:col-span-8">
            <CardHeader>
              <CardTitle>Lesson Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={lesson.name} onChange={(e) => updateLesson({ name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Input value={lesson.type} onChange={(e) => updateLesson({ type: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Lesson Due date</Label>
                  <Input
                    type="date"
                    value={lesson.due_date}
                    onChange={(e) => updateLesson({ due_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Publish lesson</p>
                    <p className="text-xs text-muted-foreground">Visible to students when section is published</p>
                  </div>
                  <Switch
                    checked={Boolean(lesson.is_published)}
                    onCheckedChange={(checked) => updateLesson({ is_published: checked })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Instruction</Label>
                <Textarea
                  value={lesson.instruction || ""}
                  onChange={(e) => updateLesson({ instruction: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Resource Mode</Label>
                  <Select
                    value={lesson.resource_mode}
                    onValueChange={(value) => updateLesson({ resource_mode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal content</SelectItem>
                      <SelectItem value="external_url">External URL</SelectItem>
                      <SelectItem value="uploaded">Uploaded file</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Min words</Label>
                  <Input
                    type="number"
                    value={lesson.min_words}
                    onChange={(e) => updateLesson({ min_words: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max words</Label>
                  <Input
                    type="number"
                    value={lesson.max_words}
                    onChange={(e) => updateLesson({ max_words: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="lesson-requires-text">Requires text</Label>
                  <Switch
                    id="lesson-requires-text"
                    checked={Boolean(lesson.requires_text)}
                    onCheckedChange={(checked) => updateLesson({ requires_text: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="lesson-requires-image">Requires image</Label>
                  <Switch
                    id="lesson-requires-image"
                    checked={Boolean(lesson.requires_image)}
                    onCheckedChange={(checked) => updateLesson({ requires_image: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="lesson-requires-audio">Requires audio</Label>
                  <Switch
                    id="lesson-requires-audio"
                    checked={Boolean(lesson.requires_audio)}
                    onCheckedChange={(checked) => updateLesson({ requires_audio: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-12 lg:col-span-4">
            <CardHeader>
              <CardTitle>Resource</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lesson.resource_mode === "internal" ? (
                <>
                  <div className="space-y-2">
                    <Label>Internal Type</Label>
                    <Select
                      value={lesson.resource_ref_type || "passage"}
                      onValueChange={(value) => updateLesson({ resource_ref_type: value, resource_ref_id: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="passage">Passage</SelectItem>
                        <SelectItem value="section">Section</SelectItem>
                        <SelectItem value="speaking">Speaking</SelectItem>
                        <SelectItem value="writing">Writing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Search</Label>
                    <Input
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                      placeholder="Search by title or id"
                    />
                  </div>
                  <ScrollArea className="h-64 rounded-md border p-2">
                    <div className="space-y-2">
                      {currentResources.map((item) => {
                        const selected = String(lesson.resource_ref_id || "") === String(item?._id || "");
                        return (
                          <Button
                            key={String(item?._id || "")}
                            type="button"
                            variant={selected ? "default" : "outline"}
                            className="h-auto w-full justify-start py-2 text-left"
                            onClick={() => updateLesson({ resource_ref_id: item?._id || "" })}
                          >
                            <span className="line-clamp-1">{item?.title || item?._id}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              ) : null}

              {lesson.resource_mode === "external_url" ? (
                <div className="space-y-2">
                  <Label>External URL</Label>
                  <Input
                    value={lesson.resource_url || ""}
                    onChange={(e) => updateLesson({ resource_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              ) : null}

              {lesson.resource_mode === "uploaded" ? (
                <div className="space-y-3">
                  <input
                    ref={uploadInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => void handleUploadSelected(event)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUploadClick}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading..." : "Upload Resource"}
                  </Button>
                  <div className="space-y-2">
                    <Label>Uploaded URL</Label>
                    <Input
                      value={lesson.resource_url || ""}
                      onChange={(e) => updateLesson({ resource_url: e.target.value })}
                    />
                  </div>
                </div>
              ) : null}

              {lesson.resource_url ? (
                <div className="space-y-2 rounded-md border p-3">
                  <Badge variant="secondary">Current Resource</Badge>
                  <a
                    href={lesson.resource_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-sm text-primary"
                  >
                    Open link
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
