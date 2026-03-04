import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, MoreVertical, Plus, Trash2 } from "lucide-react";
import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { resolveVideoPreview } from "./homework.utils";
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
  content_blocks: [],
});

const createTempId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const BLOCK_TYPES = [
  { type: "instruction", label: "Instruction" },
  { type: "video", label: "Video" },
  { type: "input", label: "Input" },
  { type: "title", label: "Title" },
  { type: "internal", label: "Internal Content" },
];

const INPUT_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image Upload" },
  { value: "audio", label: "Audio Recording" },
];

const resolveInputTypeFromData = (data = {}) => {
  const explicitType = String(data?.input_type || "").trim().toLowerCase();
  if (["text", "image", "audio"].includes(explicitType)) return explicitType;
  if (Boolean(data?.requires_audio)) return "audio";
  if (Boolean(data?.requires_image)) return "image";
  return "text";
};

const normalizeInputBlockData = (data = {}) => {
  const inputType = resolveInputTypeFromData(data);
  const requiresText = inputType === "text";
  const requiresImage = inputType === "image";
  const requiresAudio = inputType === "audio";
  return {
    input_type: inputType,
    requires_text: requiresText,
    requires_image: requiresImage,
    requires_audio: requiresAudio,
    min_words: requiresText ? data?.min_words ?? "" : "",
    max_words: requiresText ? data?.max_words ?? "" : "",
  };
};

const createBlock = (type, data = {}) => {
  if (type === "instruction") {
    return { id: createTempId(), type, data: { text: "", ...data } };
  }
  if (type === "video") {
    return { id: createTempId(), type, data: { url: "", ...data } };
  }
  if (type === "input") {
    return {
      id: createTempId(),
      type,
      data: normalizeInputBlockData({
        input_type: "text",
        min_words: "",
        max_words: "",
        ...data,
      }),
    };
  }
  if (type === "title") {
    return { id: createTempId(), type, data: { text: "", ...data } };
  }
  return {
    id: createTempId(),
    type: "internal",
    data: {
      resource_ref_type: "passage",
      resource_ref_id: "",
      ...data,
    },
  };
};

const buildBlocksFromLesson = (lesson = {}) => {
  const savedBlocks = Array.isArray(lesson?.content_blocks)
    ? lesson.content_blocks
    : [];
  if (savedBlocks.length) {
    return savedBlocks
      .slice()
      .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
      .map((block) => createBlock(block?.type || "instruction", block?.data || {}));
  }

  const blocks = [];
  if (lesson.instruction) {
    blocks.push(createBlock("instruction", { text: lesson.instruction }));
  }
  if (lesson.resource_mode === "internal") {
    blocks.push(
      createBlock("internal", {
        resource_ref_type: lesson.resource_ref_type || "passage",
        resource_ref_id: lesson.resource_ref_id || "",
      }),
    );
  }
  if (lesson.resource_mode === "external_url" || lesson.resource_mode === "uploaded") {
    blocks.push(createBlock("video", { url: lesson.resource_url || "" }));
  }
  const hasInputConfig =
    Boolean(lesson.requires_text) ||
    Boolean(lesson.requires_image) ||
    Boolean(lesson.requires_audio) ||
    String(lesson.min_words ?? "").trim() !== "" ||
    String(lesson.max_words ?? "").trim() !== "";
  if (hasInputConfig) {
    blocks.push(
      createBlock("input", {
        input_type: lesson.requires_audio ? "audio" : lesson.requires_image ? "image" : "text",
        requires_text: Boolean(lesson.requires_text),
        requires_image: Boolean(lesson.requires_image),
        requires_audio: Boolean(lesson.requires_audio),
        min_words: lesson.min_words ?? "",
        max_words: lesson.max_words ?? "",
      }),
    );
  }
  if (!blocks.length) {
    blocks.push(createBlock("instruction"));
  }
  return blocks;
};

const applyBlocksToLesson = (lesson = {}, blocks = []) => {
  const next = { ...lesson };
  const normalizedBlocks = Array.isArray(blocks) ? blocks : [];
  next.content_blocks = normalizedBlocks.map((block, index) => ({
    type: block?.type || "instruction",
    order: index,
    data:
      block?.type === "input"
        ? normalizeInputBlockData(block?.data || {})
        : block?.data && typeof block.data === "object"
          ? { ...block.data }
          : {},
  }));

  const mergedInstruction = normalizedBlocks
    .filter((block) => block.type === "title" || block.type === "instruction")
    .map((block) => String(block?.data?.text || "").trim())
    .filter(Boolean)
    .join("\n\n");
  next.instruction = mergedInstruction;

  const inputBlocks = normalizedBlocks.filter((block) => block.type === "input");
  const inputBlock = inputBlocks[inputBlocks.length - 1];
  if (inputBlock) {
    const normalizedInputData = normalizeInputBlockData(inputBlock?.data || {});
    next.requires_text = Boolean(normalizedInputData.requires_text);
    next.requires_image = Boolean(normalizedInputData.requires_image);
    next.requires_audio = Boolean(normalizedInputData.requires_audio);
    next.min_words = normalizedInputData.min_words ?? "";
    next.max_words = normalizedInputData.max_words ?? "";
  } else {
    next.requires_text = false;
    next.requires_image = false;
    next.requires_audio = false;
    next.min_words = "";
    next.max_words = "";
  }

  const resourceBlocks = normalizedBlocks.filter((block) => block.type === "internal" || block.type === "video");
  const resourceBlock = resourceBlocks[resourceBlocks.length - 1];
  if (resourceBlock?.type === "internal") {
    next.resource_mode = "internal";
    next.resource_ref_type = resourceBlock?.data?.resource_ref_type || "passage";
    next.resource_ref_id = resourceBlock?.data?.resource_ref_id || "";
    next.resource_url = "";
    next.resource_storage_key = "";
  } else if (resourceBlock?.type === "video") {
    next.resource_mode = "external_url";
    next.resource_ref_type = null;
    next.resource_ref_id = "";
    next.resource_url = String(resourceBlock?.data?.url || "").trim();
    next.resource_storage_key = "";
  } else {
    next.resource_mode = "internal";
    next.resource_ref_type = null;
    next.resource_ref_id = "";
    next.resource_url = "";
    next.resource_storage_key = "";
  }

  return next;
};

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assignment, setAssignment] = useState(null);
  const [section, setSection] = useState(null);
  const [lesson, setLesson] = useState(createLessonForm);
  const [isLessonSettingsOpen, setIsLessonSettingsOpen] = useState(false);
  const [contentBlocks, setContentBlocks] = useState([]);
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
      setContentBlocks(buildBlocksFromLesson(nextLesson));
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

  const filteredResourcesByType = useMemo(() => {
    const keyword = String(searchKeyword || "").trim().toLowerCase();
    const next = {};
    ["passage", "section", "speaking", "writing"].forEach((type) => {
      const list = catalog[type] || [];
      next[type] = !keyword
        ? list.slice(0, 40)
        : list
            .filter((item) => `${item?.title || ""} ${item?._id || ""}`.toLowerCase().includes(keyword))
            .slice(0, 40);
    });
    return next;
  }, [catalog, searchKeyword]);

  const addBlock = (type) => {
    setContentBlocks((prev) => [...prev, createBlock(type)]);
  };

  const removeBlock = (blockId) => {
    setContentBlocks((prev) => prev.filter((block) => String(block.id) !== String(blockId)));
  };

  const moveBlock = (blockId, direction) => {
    setContentBlocks((prev) => {
      const currentIndex = prev.findIndex((block) => String(block.id) === String(blockId));
      if (currentIndex < 0) return prev;
      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(currentIndex, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const updateBlockData = (blockId, patch) => {
    setContentBlocks((prev) =>
      prev.map((block) =>
        String(block.id) === String(blockId)
          ? {
              ...block,
              data: {
                ...block.data,
                ...patch,
              },
            }
          : block,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextLesson = applyBlocksToLesson(lesson, contentBlocks);
      const payload = {
        name: String(nextLesson.name || "").trim(),
        type: String(nextLesson.type || "").trim(),
        instruction: String(nextLesson.instruction || ""),
        due_date: String(nextLesson.due_date || "").trim() || null,
        is_published: Boolean(nextLesson.is_published),
        resource_mode: nextLesson.resource_mode,
        resource_ref_type: nextLesson.resource_mode === "internal" ? nextLesson.resource_ref_type : null,
        resource_ref_id: nextLesson.resource_mode === "internal" ? nextLesson.resource_ref_id : null,
        resource_url:
          nextLesson.resource_mode === "internal" ? null : String(nextLesson.resource_url || "").trim() || null,
        resource_storage_key:
          nextLesson.resource_mode === "uploaded"
            ? String(nextLesson.resource_storage_key || "").trim() || null
            : null,
        requires_text: Boolean(nextLesson.requires_text),
        requires_image: Boolean(nextLesson.requires_image),
        requires_audio: Boolean(nextLesson.requires_audio),
        min_words: nextLesson.min_words === "" ? null : Number(nextLesson.min_words),
        max_words: nextLesson.max_words === "" ? null : Number(nextLesson.max_words),
        content_blocks: Array.isArray(nextLesson.content_blocks) ? nextLesson.content_blocks : [],
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

  const handleOpenStudentPreview = () => {
    if (!id) return;
    window.open(`/homework/my/${id}?preview=1`, "_blank", "noopener,noreferrer");
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
              <Button variant="outline" onClick={handleOpenStudentPreview}>
                Preview
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Lesson"}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 lg:col-span-8">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Lesson Details</CardTitle>
                <CardDescription>Edit lesson name, type, and due date from settings menu.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <p className="text-sm font-medium">Publish lesson</p>
                  <Switch
                    checked={Boolean(lesson.is_published)}
                    onCheckedChange={(checked) => updateLesson({ is_published: checked })}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsLessonSettingsOpen(true)}
                  aria-label="Open lesson settings"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!contentBlocks.length ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Use the <span className="font-medium">Add content</span> panel to add your first block.
                </div>
              ) : null}
              <div className="space-y-3">
                {contentBlocks.map((block, index) => (
                  <div key={block.id} className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {index + 1}.{" "}
                        {BLOCK_TYPES.find((item) => item.type === block.type)?.label || "Block"}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => moveBlock(block.id, "up")}
                          disabled={index === 0}
                          aria-label="Move block up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => moveBlock(block.id, "down")}
                          disabled={index === contentBlocks.length - 1}
                          aria-label="Move block down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeBlock(block.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {block.type === "title" ? (
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={block.data.text || ""}
                          onChange={(event) => updateBlockData(block.id, { text: event.target.value })}
                          placeholder="Add heading text"
                        />
                      </div>
                    ) : null}

                    {block.type === "instruction" ? (
                      <div className="space-y-2">
                        <Label>Instruction</Label>
                        <Textarea
                          value={block.data.text || ""}
                          onChange={(event) => updateBlockData(block.id, { text: event.target.value })}
                          placeholder="Add instruction for students..."
                        />
                      </div>
                    ) : null}

                    {block.type === "video" ? (
                      <div className="space-y-2">
                        <Label>Video URL</Label>
                        <Input
                          value={block.data.url || ""}
                          onChange={(event) => updateBlockData(block.id, { url: event.target.value })}
                          placeholder="https://youtube.com/..."
                        />
                        {(() => {
                          const preview = resolveVideoPreview(block.data.url || "");
                          if (preview.kind === "youtube" && preview.youtubeId) {
                            return (
                              <div className="overflow-hidden rounded-md border homework-video-lite">
                                <LiteYouTubeEmbed
                                  id={preview.youtubeId}
                                  title={`Video preview ${block.id}`}
                                  noCookie
                                  adNetwork={false}
                                  poster="maxresdefault"
                                  params="cc_load_policy=0&iv_load_policy=3&modestbranding=1&rel=0"
                                  webp
                                />
                              </div>
                            );
                          }
                          if (preview.kind === "vimeo") {
                            return (
                              <div className="overflow-hidden rounded-md border">
                                <iframe
                                  src={preview.src}
                                  title={`Video preview ${block.id}`}
                                  className="aspect-video w-full"
                                  allow="autoplay; fullscreen; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            );
                          }
                          if (preview.kind === "direct") {
                            return (
                              <div className="overflow-hidden rounded-md border">
                                <video controls className="aspect-video w-full" src={preview.src} />
                              </div>
                            );
                          }
                          if (preview.kind === "unsupported") {
                            return (
                              <p className="text-xs text-muted-foreground">
                                URL này chưa hỗ trợ embed preview.{" "}
                                <a
                                  href={preview.src}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary underline-offset-4 hover:underline"
                                >
                                  Open link
                                </a>
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ) : null}

                    {block.type === "input" ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Student input type</Label>
                          <Select
                            value={resolveInputTypeFromData(block.data)}
                            onValueChange={(value) =>
                              updateBlockData(
                                block.id,
                                normalizeInputBlockData({ ...(block.data || {}), input_type: value }),
                              )}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INPUT_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {resolveInputTypeFromData(block.data) === "text" ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                              <Label>Min words</Label>
                              <Input
                                type="number"
                                value={block.data.min_words ?? ""}
                                onChange={(event) => updateBlockData(block.id, { min_words: event.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Max words</Label>
                              <Input
                                type="number"
                                value={block.data.max_words ?? ""}
                                onChange={(event) => updateBlockData(block.id, { max_words: event.target.value })}
                              />
                            </div>
                          </div>
                        ) : resolveInputTypeFromData(block.data) === "image" ? (
                          <p className="text-xs text-muted-foreground">
                            Student will only see image upload input.
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Student will record audio directly on the page.
                          </p>
                        )}
                      </div>
                    ) : null}

                    {block.type === "internal" ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Internal Type</Label>
                          <Select
                            value={block.data.resource_ref_type || "passage"}
                            onValueChange={(value) =>
                              updateBlockData(block.id, { resource_ref_type: value, resource_ref_id: "" })}
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
                        <ScrollArea className="h-56 rounded-md border p-2">
                          <div className="space-y-2">
                            {(filteredResourcesByType[String(block.data.resource_ref_type || "passage")] || []).map((item) => {
                              const selected = String(block.data.resource_ref_id || "") === String(item?._id || "");
                              return (
                                <Button
                                  key={String(item?._id || "")}
                                  type="button"
                                  variant={selected ? "default" : "outline"}
                                  className="h-auto w-full justify-start py-2 text-left"
                                  onClick={() => updateBlockData(block.id, { resource_ref_id: item?._id || "" })}
                                >
                                  <span className="line-clamp-1">{item?.title || item?._id}</span>
                                </Button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-12 lg:col-span-4">
            <CardHeader>
              <CardTitle>Add content</CardTitle>
              <CardDescription>Add block types. Block editor will show in left panel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {BLOCK_TYPES.map((option) => {
                  return (
                    <Button
                      key={option.type}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock(option.type)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {option.label}
                    </Button>
                  );
                })}
              </div>
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                {contentBlocks.length
                  ? `Added: ${contentBlocks.map((block) => BLOCK_TYPES.find((item) => item.type === block.type)?.label || "Block").join(", ")}`
                  : "No blocks added yet."}
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={isLessonSettingsOpen} onOpenChange={setIsLessonSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lesson Settings</DialogTitle>
              <DialogDescription>Update name, type, and due date for this lesson.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={lesson.name} onChange={(e) => updateLesson({ name: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsLessonSettingsOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
