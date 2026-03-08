
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  Copy,
  GripVertical,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { toMonthValue } from "./homework.utils";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import "./Homework.css";

const createTempId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createLesson = (name = "", index = 0, dueDate = "") => ({
  _id: createTempId(),
  name: String(name || "").trim() || `Lesson ${index + 1}`,
  type: "custom_task",
  instruction: "",
  order: index,
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
  due_date: toDateInputValue(dueDate),
  content_blocks: [],
});

const createSection = (name = "", index = 0) => ({
  _id: createTempId(),
  name: String(name || "").trim() || `Section ${index + 1}`,
  order: index,
  is_published: false,
  lessons: [],
});

const createForm = () => ({
  title: "",
  description: "",
  month: toMonthValue(),
  due_date: "",
  status: "draft",
  target_group_ids: [],
  sections: [],
});


const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const deriveWeekFromDueDate = (value) => {
  const normalized = String(value || "").trim();
  const fromDateInput = /^\d{4}-\d{2}-\d{2}/.test(normalized) ? Number(normalized.slice(8, 10)) : NaN;
  const day = Number.isFinite(fromDateInput) ? fromDateInput : new Date(normalized).getUTCDate();
  if (!Number.isFinite(day) || day < 1) return 1;
  return Math.min(5, Math.max(1, Math.floor((day - 1) / 7) + 1));
};

const normalizeOutlineOrders = (sections = []) =>
  (Array.isArray(sections) ? sections : []).map((section, sectionIndex) => ({
    ...section,
    order: sectionIndex,
    lessons: (Array.isArray(section.lessons) ? section.lessons : []).map((lesson, lessonIndex) => ({
      ...lesson,
      order: lessonIndex,
    })),
  }));

const normalizeSectionsFromAssignment = (assignment = {}) => {
  const sections = Array.isArray(assignment?.sections) ? assignment.sections : [];
  if (sections.length > 0) {
    return normalizeOutlineOrders(
      sections.map((section, sectionIndex) => ({
        _id: String(section?._id || createTempId()),
        name: section?.name || `Section ${sectionIndex + 1}`,
        order: Number.isFinite(Number(section?.order)) ? Number(section.order) : sectionIndex,
        is_published: Boolean(section?.is_published),
        lessons: (Array.isArray(section?.lessons) ? section.lessons : []).map((lesson, lessonIndex) => ({
          ...createLesson("", lessonIndex),
          ...lesson,
          _id: String(lesson?._id || createTempId()),
          name: lesson?.name || lesson?.title || `Lesson ${lessonIndex + 1}`,
          is_published: Boolean(lesson?.is_published),
          due_date: toDateInputValue(lesson?.due_date),
        })),
      })),
    );
  }

  const tasks = Array.isArray(assignment?.tasks) ? assignment.tasks : [];
  if (!tasks.length) return [];


  return [
    {
      _id: createTempId(),
      name: "General",
      order: 0,
      is_published: true,
      lessons: tasks.map((task, index) => ({
        ...createLesson("", index),
        _id: String(task?._id || createTempId()),
        name: task?.title || `Lesson ${index + 1}`,
        type: task?.type || "custom_task",
        instruction: task?.instruction || "",
        order: Number.isFinite(Number(task?.order)) ? Number(task.order) : index,
        is_published: true,
        resource_mode: task?.resource_mode || "internal",
        resource_ref_type: task?.resource_ref_type || "passage",
        resource_ref_id: task?.resource_ref_id || "",
        resource_url: task?.resource_url || "",
        resource_storage_key: task?.resource_storage_key || "",
        requires_text: Boolean(task?.requires_text),
        requires_image: Boolean(task?.requires_image),
        requires_audio: Boolean(task?.requires_audio),
        min_words: task?.min_words ?? "",
        max_words: task?.max_words ?? "",
        due_date: toDateInputValue(task?.due_date),
      })),
    },
  ];
};

const outlinePayload = (sections = []) =>
  normalizeOutlineOrders(sections).map((section) => ({
    _id: section._id,
    name: String(section.name || "").trim() || "Section",
    order: section.order,
    is_published: Boolean(section.is_published),
    lessons: (Array.isArray(section.lessons) ? section.lessons : []).map((lesson) => ({
      _id: lesson._id,
      name: String(lesson.name || "").trim() || "Lesson",
      type: String(lesson.type || "custom_task"),
      instruction: String(lesson.instruction || ""),
      order: lesson.order,
      is_published: Boolean(lesson.is_published),
      resource_mode: lesson.resource_mode || "internal",
      resource_ref_type: lesson.resource_ref_type || null,
      resource_ref_id: lesson.resource_ref_id || null,
      resource_url: lesson.resource_url || null,
      resource_storage_key: lesson.resource_storage_key || null,
      requires_text: Boolean(lesson.requires_text),
      requires_image: Boolean(lesson.requires_image),
      requires_audio: Boolean(lesson.requires_audio),
      min_words: lesson.min_words === "" ? null : Number(lesson.min_words),
      max_words: lesson.max_words === "" ? null : Number(lesson.max_words),
      due_date: lesson.due_date || null,
      content_blocks: Array.isArray(lesson.content_blocks)
        ? lesson.content_blocks.map((block, index) => ({
          type: String(block?.type || "instruction"),
          order: Number.isFinite(Number(block?.order)) ? Number(block.order) : index,
          data: block?.data && typeof block.data === "object" ? { ...block.data } : {},
        }))
        : [],
    })),
  }));

const dndSectionId = (sectionId) => `section:${sectionId}`;
const dndLessonId = (sectionId, lessonId) => `lesson:${sectionId}:${lessonId}`;

const parseDndId = (rawId) => {
  const value = String(rawId || "");
  if (value.startsWith("section:")) {
    return { type: "section", sectionId: value.replace("section:", "") };
  }
  if (value.startsWith("lesson:")) {
    const [, sectionId, lessonId] = value.split(":");
    return { type: "lesson", sectionId, lessonId };
  }
  return null;
};
function SortableLessonRow({
  sectionId,
  lesson,
  canManage,
  assignmentId,
  onTogglePublish,
  onMenuAction,
  onDueDateChange,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dndLessonId(sectionId, lesson._id),
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-background p-2"
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 cursor-grab text-muted-foreground"
        disabled={!canManage}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </Button>

      <div className="min-w-0 flex-1">
        {assignmentId ? (
          <Link
            to={`/homework/assignments/${assignmentId}/lessons/${lesson._id}`}
            className="inline-flex items-center gap-1 truncate text-sm font-medium text-primary hover:underline"
          >
            <span className="truncate">{lesson.name}</span>
          </Link>
        ) : (
          <p className="truncate text-sm font-medium">{lesson.name}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <DatePicker
          value={toDateInputValue(lesson.due_date)}
          onChange={onDueDateChange}
          placeholder="Due date"
          disabled={!canManage}
          buttonClassName="h-8 w-[9.5rem] justify-start px-2 text-xs"
        />
        <div className="flex items-center gap-1">
          <Label htmlFor={`lesson-publish-${lesson._id}`} className="text-xs text-muted-foreground">
            Publish
          </Label>
          <Switch
            id={`lesson-publish-${lesson._id}`}
            checked={Boolean(lesson.is_published)}
            disabled={!canManage}
            onCheckedChange={(checked) => onTogglePublish(checked)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={!canManage}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onMenuAction("rename")}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename Lesson
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMenuAction("duplicate")}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate Lesson
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMenuAction("delete")} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Lesson
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function SortableSectionCard({
  section,
  canManage,
  assignmentId,
  addingLessonSectionId,
  newLessonName,
  onNewLessonNameChange,
  onShowAddLesson,
  onCancelAddLesson,
  onCreateLesson,
  onTogglePublish,
  onSectionMenuAction,
  onLessonTogglePublish,
  onLessonMenuAction,
  onLessonDueDateChange,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dndSectionId(section._id),
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.72 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 cursor-grab text-muted-foreground"
            disabled={!canManage}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{section.name}</CardTitle>
            <CardDescription>{(section.lessons || []).length} lesson(s)</CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor={`section-publish-${section._id}`} className="text-xs text-muted-foreground">
              Publish
            </Label>
            <Switch
              id={`section-publish-${section._id}`}
              checked={Boolean(section.is_published)}
              disabled={!canManage}
              onCheckedChange={(checked) => onTogglePublish(checked)}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={!canManage}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSectionMenuAction("rename")}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename Section
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSectionMenuAction("duplicate")}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate Section
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSectionMenuAction("delete")} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <SortableContext
          items={(section.lessons || []).map((lesson) => dndLessonId(section._id, lesson._id))}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {(section.lessons || []).map((lesson) => (
              <SortableLessonRow
                key={lesson._id}
                sectionId={section._id}
                lesson={lesson}
                canManage={canManage}
                assignmentId={assignmentId}
                onTogglePublish={(checked) => onLessonTogglePublish(lesson._id, checked)}
                onMenuAction={(action) => onLessonMenuAction(lesson._id, action)}
                onDueDateChange={(value) => onLessonDueDateChange(lesson._id, value)}
              />
            ))}
          </div>
        </SortableContext>

        {addingLessonSectionId === section._id ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed p-2">
            <Input
              value={newLessonName}
              onChange={(event) => onNewLessonNameChange(event.target.value)}
              placeholder="Input name"
              disabled={!canManage}
            />
            <Button type="button" variant="outline" onClick={onCancelAddLesson} disabled={!canManage}>
              Cancel
            </Button>
            <Button type="button" onClick={() => onCreateLesson(section._id)} disabled={!canManage}>
              Save
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => onShowAddLesson(section._id)} disabled={!canManage}>
            <Plus className="mr-2 h-4 w-4" />
            New Lesson
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
export default function HomeworkAssignmentEditorPage() {
  const { id } = useParams();
  const editId = id && id !== "new" ? id : null;
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const outlineSaveVersionRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [outlineSaving, setOutlineSaving] = useState(false);
  const [error, setError] = useState("");
  const [canManage, setCanManage] = useState(true);
  const [form, setForm] = useState(createForm);
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [addingLessonSectionId, setAddingLessonSectionId] = useState("");
  const [newLessonName, setNewLessonName] = useState("");
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [renameState, setRenameState] = useState({
    open: false,
    type: "",
    sectionId: "",
    lessonId: "",
    value: "",
  });
  const [deleteState, setDeleteState] = useState({
    open: false,
    type: "",
    sectionId: "",
    lessonId: "",
    label: "",
  });

  const handleOpenStudentPreview = () => {
    if (!editId) return;
    window.open(`/student-ielts/homework/${editId}?preview=1`, "_blank", "noopener,noreferrer");
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [groupsRes, teachersRes, assignmentRes] = await Promise.all([
        api.homeworkGetGroups({ limit: 200 }),
        api.getUsers('teacher'),
        editId ? api.homeworkGetAssignmentById(editId) : Promise.resolve(null),
      ]);

      setGroups(Array.isArray(groupsRes?.data) ? groupsRes.data.filter((group) => group?.is_active !== false) : []);
      setTeachers(Array.isArray(teachersRes?.data) ? teachersRes.data : []);

      if (assignmentRes?.data) {
        const assignment = assignmentRes.data;
        setCanManage(Boolean(assignment.can_manage));
        setForm({
          title: assignment.title || "",
          description: assignment.description || "",
          month: assignment.month || toMonthValue(),
          due_date: toDateInputValue(assignment.due_date),
          status: assignment.status || "draft",
          target_group_ids: Array.isArray(assignment.target_group_ids)
            ? assignment.target_group_ids.map((group) => String(group?._id || group))
            : [],
          co_teachers: Array.isArray(assignment.co_teachers)
            ? assignment.co_teachers.map((teacher) => String(teacher?._id || teacher))
            : [],
          sections: normalizeSectionsFromAssignment(assignment),
        });
        if (editId && assignment.title) {
          window.dispatchEvent(new CustomEvent('breadcrumb-label-override', {
            detail: { segment: editId, label: assignment.title },
          }));
        }
      } else {
        setCanManage(true);
        setForm(createForm());
      }
    } catch (loadError) {
      setError(loadError?.message || "Failed to load editor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [editId]);

  useEffect(() => {
    if (!editId) {
      setIsSettingsDialogOpen(true);
      return;
    }
    setIsSettingsDialogOpen(false);
  }, [editId]);

  const toggleGroup = (groupId) => {
    setForm((prev) => {
      const set = new Set((prev.target_group_ids || []).map(String));
      const normalized = String(groupId || "");
      if (set.has(normalized)) set.delete(normalized);
      else set.add(normalized);
      return { ...prev, target_group_ids: Array.from(set) };
    });
  };

  const toggleCoTeacher = (teacherId) => {
    setForm((prev) => {
      const set = new Set((prev.co_teachers || []).map(String));
      const normalized = String(teacherId || "");
      if (set.has(normalized)) set.delete(normalized);
      else set.add(normalized);
      return { ...prev, co_teachers: Array.from(set) };
    });
  };

  const persistOutline = async (sections, { syncFromServer = true } = {}) => {
    if (!editId || !canManage) return;
    const version = ++outlineSaveVersionRef.current;
    setOutlineSaving(true);
    try {
      const response = await api.homeworkPatchAssignmentOutline(editId, {
        sections: outlinePayload(sections),
      });
      if (version !== outlineSaveVersionRef.current) return;
      if (syncFromServer) {
        const serverSections = normalizeSectionsFromAssignment(response?.data || {});
        setForm((prev) => ({ ...prev, sections: serverSections }));
      }
    } catch (saveError) {
      showNotification(saveError?.message || "Failed to auto-save outline", "error");
    } finally {
      if (version === outlineSaveVersionRef.current) setOutlineSaving(false);
    }
  };

  const updateSections = (updater, { saveOutline = true, syncFromServer = true } = {}) => {
    setForm((prev) => {
      const cloned = (prev.sections || []).map((section) => ({
        ...section,
        lessons: (section.lessons || []).map((lesson) => ({ ...lesson })),
      }));
      const next = normalizeOutlineOrders(updater(cloned));
      if (saveOutline && editId && canManage) {
        void persistOutline(next, { syncFromServer });
      }
      return { ...prev, sections: next };
    });
  };

  const handleCreateSection = () => {
    const normalizedName = String(newSectionName || "").trim();
    if (!normalizedName) {
      showNotification("Section name is required", "warning");
      return;
    }
    updateSections((sections) => [...sections, createSection(normalizedName, sections.length, form.due_date)]);
    setShowAddSection(false);
    setNewSectionName("");
  };

  const handleCreateLesson = (sectionId) => {
    const normalizedName = String(newLessonName || "").trim();
    if (!normalizedName) {
      showNotification("Lesson name is required", "warning");
      return;
    }
    updateSections((sections) =>
      sections.map((section) => {
        if (String(section._id) !== String(sectionId)) return section;
        return {
          ...section,
          lessons: [
            ...(section.lessons || []),
            createLesson(normalizedName, (section.lessons || []).length, form.due_date),
          ],
        };
      }),
    );
    setAddingLessonSectionId("");
    setNewLessonName("");
  };

  const openRenameDialog = ({ type, sectionId, lessonId, value }) => {
    setRenameState({
      open: true,
      type,
      sectionId: sectionId || "",
      lessonId: lessonId || "",
      value: value || "",
    });
  };

  const handleConfirmRename = () => {
    const nextValue = String(renameState.value || "").trim();
    if (!nextValue) {
      showNotification("Name cannot be empty", "warning");
      return;
    }
    if (renameState.type === "section") {
      updateSections((sections) =>
        sections.map((section) =>
          String(section._id) === String(renameState.sectionId) ? { ...section, name: nextValue } : section,
        ),
      );
    }
    if (renameState.type === "lesson") {
      updateSections((sections) =>
        sections.map((section) => ({
          ...section,
          lessons: (section.lessons || []).map((lesson) =>
            String(section._id) === String(renameState.sectionId) &&
              String(lesson._id) === String(renameState.lessonId)
              ? { ...lesson, name: nextValue }
              : lesson,
          ),
        })),
      );
    }
    setRenameState({ open: false, type: "", sectionId: "", lessonId: "", value: "" });
  };

  const openDeleteDialog = ({ type, sectionId, lessonId, label }) => {
    setDeleteState({
      open: true,
      type: type || "",
      sectionId: sectionId || "",
      lessonId: lessonId || "",
      label: label || "",
    });
  };
  const confirmDelete = () => {
    if (deleteState.type === "section") {
      updateSections((sections) => sections.filter((section) => String(section._id) !== String(deleteState.sectionId)));
    }
    if (deleteState.type === "lesson") {
      updateSections((sections) =>
        sections.map((section) => {
          if (String(section._id) !== String(deleteState.sectionId)) return section;
          return {
            ...section,
            lessons: (section.lessons || []).filter(
              (lesson) => String(lesson._id) !== String(deleteState.lessonId),
            ),
          };

        }),
      );
    }
    setDeleteState({ open: false, type: "", sectionId: "", lessonId: "", label: "" });
  };

  const duplicateSection = (sectionId) => {
    updateSections((sections) => {
      const source = sections.find((section) => String(section._id) === String(sectionId));
      if (!source) return sections;
      const copy = {
        ...source,
        _id: createTempId(),
        name: `${source.name} (Copy)`,
        is_published: false,
        lessons: (source.lessons || []).map((lesson, index) => ({
          ...lesson,
          _id: createTempId(),
          order: index,
          is_published: false,
        })),
      };
      return [...sections, copy];
    });
  };

  const duplicateLesson = (sectionId, lessonId) => {
    updateSections((sections) =>
      sections.map((section) => {
        if (String(section._id) !== String(sectionId)) return section;
        const source = (section.lessons || []).find((lesson) => String(lesson._id) === String(lessonId));
        if (!source) return section;
        return {
          ...section,
          lessons: [
            ...(section.lessons || []),
            {
              ...source,
              _id: createTempId(),
              name: `${source.name} (Copy)`,
              is_published: false,
            },
          ],
        };
      }),
    );
  };

  const handleDragEnd = ({ active, over }) => {
    if (!active?.id || !over?.id || active.id === over.id) return;

    const activeInfo = parseDndId(active.id);
    const overInfo = parseDndId(over.id);
    if (!activeInfo || !overInfo) return;

    if (activeInfo.type === "section" && overInfo.type === "section") {
      updateSections((sections) => {
        const oldIndex = sections.findIndex((section) => String(section._id) === String(activeInfo.sectionId));
        const newIndex = sections.findIndex((section) => String(section._id) === String(overInfo.sectionId));
        if (oldIndex < 0 || newIndex < 0) return sections;
        return arrayMove(sections, oldIndex, newIndex);
      }, { syncFromServer: false });
      return;
    }

    if (activeInfo.type === "lesson") {
      updateSections((sections) => {
        const sourceSectionIndex = sections.findIndex(
          (section) => String(section._id) === String(activeInfo.sectionId),
        );
        if (sourceSectionIndex < 0) return sections;
        const sourceLessons = sections[sourceSectionIndex].lessons || [];
        const sourceLessonIndex = sourceLessons.findIndex(
          (lesson) => String(lesson._id) === String(activeInfo.lessonId),
        );
        if (sourceLessonIndex < 0) return sections;

        const movingLesson = sourceLessons[sourceLessonIndex];
        let targetSectionIndex = sourceSectionIndex;
        let targetLessonIndex = sourceLessonIndex;

        if (overInfo.type === "lesson") {
          targetSectionIndex = sections.findIndex((section) => String(section._id) === String(overInfo.sectionId));
          if (targetSectionIndex < 0) return sections;
          targetLessonIndex = (sections[targetSectionIndex].lessons || []).findIndex(
            (lesson) => String(lesson._id) === String(overInfo.lessonId),
          );
          if (targetLessonIndex < 0) targetLessonIndex = (sections[targetSectionIndex].lessons || []).length;
        } else if (overInfo.type === "section") {
          targetSectionIndex = sections.findIndex((section) => String(section._id) === String(overInfo.sectionId));
          if (targetSectionIndex < 0) return sections;
          targetLessonIndex = (sections[targetSectionIndex].lessons || []).length;
        }

        const next = sections.map((section) => ({
          ...section,
          lessons: [...(section.lessons || [])],
        }));

        next[sourceSectionIndex].lessons.splice(sourceLessonIndex, 1);
        if (sourceSectionIndex === targetSectionIndex && sourceLessonIndex < targetLessonIndex) {
          targetLessonIndex -= 1;
        }
        next[targetSectionIndex].lessons.splice(targetLessonIndex, 0, movingLesson);
        return next;
      }, { syncFromServer: false });
    }
  };

  const validateBeforeSubmit = () => {
    if (!String(form.title || "").trim()) return "Title is required";
    if (!String(form.due_date || "").trim()) return "Due date is required";
    if (!Array.isArray(form.target_group_ids) || form.target_group_ids.length === 0) {
      return "Select at least one target group";
    }
    const lessonCount = (form.sections || []).reduce(
      (sum, section) => sum + ((section.lessons || []).length || 0),
      0,
    );
    // Allow empty assignments as requested
    // if (lessonCount === 0) return "At least one lesson is required";

    for (const section of form.sections || []) {
      for (const lesson of section.lessons || []) {
        if (!String(lesson?.due_date || "").trim()) {
          return `Due date is required for lesson "${lesson?.name || "Lesson"}"`;
        }
      }
    }
    return "";
  };

  const handleSaveAssignment = async () => {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      showNotification(validationError, "error");
      return false;
    }

    setSaving(true);
    try {
      const assignmentMonth =
        String(form.month || "").trim() ||
        String(form.due_date || "").trim().slice(0, 7) ||
        toMonthValue();
      const payload = {
        title: String(form.title || "").trim(),
        description: String(form.description || "").trim(),
        month: assignmentMonth,
        week: deriveWeekFromDueDate(form.due_date),
        due_date: form.due_date,
        status: form.status || "draft",
        target_group_ids: form.target_group_ids,
        co_teachers: form.co_teachers,
        sections: outlinePayload(form.sections),
      };

      if (editId) {
        await api.homeworkUpdateAssignment(editId, payload);
        showNotification("Assignment updated", "success");
        await loadData();
      } else {
        const created = await api.homeworkCreateAssignment(payload);
        const newId = created?.data?._id;
        showNotification("Assignment created", "success");
        if (newId) {
          navigate(`/homework/assignments/${newId}`);
        }
      }
      return true;
    } catch (saveError) {
      showNotification(saveError?.message || "Failed to save assignment", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSettingsDone = async () => {
    if (!canManage) {
      setIsSettingsDialogOpen(false);
      return;
    }
    const saved = await handleSaveAssignment();
    if (saved) {
      setIsSettingsDialogOpen(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (outlineSaving) return "Saving outline...";
    if (!editId) return "Draft local outline";
    return "Outline synced";
  }, [outlineSaving, editId]);

  const selectedGroupsLabel = useMemo(() => {
    const selectedIds = new Set((form.target_group_ids || []).map(String));
    const selectedNames = groups
      .filter((group) => selectedIds.has(String(group._id)))
      .map((group) => String(group.name || "").trim())
      .filter(Boolean);
    if (!selectedNames.length) return "Select one or more groups";
    if (selectedNames.length <= 2) return selectedNames.join(", ");
    return `${selectedNames.length} groups selected`;
  }, [form.target_group_ids, groups]);

  const selectedCoTeachersLabel = useMemo(() => {
    const selectedIds = new Set((form.co_teachers || []).map(String));
    const selectedNames = teachers
      .filter((teacher) => selectedIds.has(String(teacher._id)))
      .map((teacher) => String(teacher.name || "").trim())
      .filter(Boolean);
    if (!selectedNames.length) return "Select co-teachers (optional)";
    if (selectedNames.length <= 2) return selectedNames.join(", ");
    return `${selectedNames.length} co-teachers selected`;
  }, [form.co_teachers, teachers]);

  if (loading) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <Card>
            <CardContent className="pt-6">Loading editor...</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="homework-page">
      <div className="homework-shell">
        <Card className="sticky top-3 z-[5]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle>{editId ? "Edit Monthly Assignment" : "Create Monthly Assignment"}</CardTitle>
              <CardDescription>
                Outline with sections and lessons. Lesson title opens dedicated editor.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{statusLabel}</Badge>
              <Button variant="outline" onClick={() => navigate("/homework")}>Back</Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Open assignment settings"
                onClick={() => setIsSettingsDialogOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <Button onClick={handleSaveAssignment} disabled={saving || !canManage}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Assignment"
                )}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="homework-danger">{error}</p>
            </CardContent>
          </Card>
        ) : null}

        {!canManage ? (
          <Card>
            <CardContent className="pt-6">
              <p className="homework-danger">You can view this assignment but cannot edit it.</p>
            </CardContent>
          </Card>
        ) : null}

        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden max-[1440px]:max-w-3xl max-[1440px]:p-4">
            <DialogHeader className="max-[1440px]:space-y-1">
              <DialogTitle className="max-[1440px]:text-base">Assignment Settings</DialogTitle>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto pr-1 max-[1440px]:pr-0 max-[1440px]:text-sm">
              <Card>
                <CardContent className="space-y-4 max-[1440px]:space-y-3 max-[1440px]:px-4 max-[1440px]:pb-4">
                  <div className="space-y-2 max-[1440px]:space-y-1.5">
                    <Label className="max-[1440px]:text-xs">Title</Label>
                    <Input
                      className="max-[1440px]:h-9 max-[1440px]:text-sm"
                      value={form.title}
                      onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      disabled={!canManage}
                    />
                  </div>
                  <div className="space-y-2 max-[1440px]:space-y-1.5">
                    <Label className="max-[1440px]:text-xs">Description</Label>
                    <Textarea
                      className="max-[1440px]:min-h-20 max-[1440px]:text-sm"
                      value={form.description}
                      onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                      disabled={!canManage}
                    />
                  </div>
                  <div className="grid grid-cols-12 gap-3 max-[1440px]:gap-2">
                    <div className="col-span-12 space-y-2 max-[1440px]:space-y-1.5 md:col-span-6">
                      <Label className="max-[1440px]:text-xs">Due date</Label>
                      <DatePicker
                        value={form.due_date}
                        onChange={(value) => setForm((prev) => ({ ...prev, due_date: value }))}
                        disabled={!canManage}
                        placeholder="Select due date"
                        buttonClassName="h-9 w-full justify-start max-[1440px]:text-sm"
                      />
                    </div>
                    <div className="col-span-12 space-y-2 max-[1440px]:space-y-1.5 md:col-span-6">
                      <Label className="max-[1440px]:text-xs">Target Groups</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between max-[1440px]:h-9 max-[1440px]:text-xs"
                            disabled={!canManage}
                          >
                            <span className="truncate">{selectedGroupsLabel}</span>
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto"
                        >
                          {groups.length ? (
                            groups.map((group) => {
                              const checked = form.target_group_ids.includes(String(group._id));
                              return (
                                <DropdownMenuCheckboxItem
                                  key={group._id}
                                  checked={checked}
                                  onCheckedChange={() => toggleGroup(group._id)}
                                  onSelect={(event) => event.preventDefault()}
                                  disabled={!canManage}
                                >
                                  <span className="truncate">
                                    {group.name} ({(group.student_ids || []).length || 0} students)
                                  </span>
                                </DropdownMenuCheckboxItem>
                              );
                            })
                          ) : (
                            <p className="px-2 py-1.5 text-sm text-muted-foreground">No groups yet.</p>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="space-y-2 max-[1440px]:space-y-1.5">
                    <Label className="max-[1440px]:text-xs">Co-Teachers (Optional)</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between max-[1440px]:h-9 max-[1440px]:text-xs"
                          disabled={!canManage}
                        >
                          <span className="truncate">{selectedCoTeachersLabel}</span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto"
                      >
                        {teachers.length ? (
                          teachers.map((teacher) => {
                            const checked = (form.co_teachers || []).includes(String(teacher._id));
                            return (
                              <DropdownMenuCheckboxItem
                                key={teacher._id}
                                checked={checked}
                                onCheckedChange={() => toggleCoTeacher(teacher._id)}
                                onSelect={(event) => event.preventDefault()}
                                disabled={!canManage}
                              >
                                <span className="truncate">{teacher.name} ({teacher.email})</span>
                              </DropdownMenuCheckboxItem>
                            );
                          })
                        ) : (
                          <p className="px-2 py-1.5 text-sm text-muted-foreground">No teachers found.</p>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-2 max-[1440px]:space-y-1.5">
                    <Label className="max-[1440px]:text-xs">Status</Label>
                    <div className="flex flex-wrap gap-2 max-[1440px]:gap-1.5">
                      {["draft", "published", "archived"].map((status) => (
                        <Button
                          key={status}
                          className="max-[1440px]:h-8 max-[1440px]:px-2.5 max-[1440px]:text-xs"
                          type="button"
                          variant={form.status === status ? "default" : "outline"}
                          onClick={() => setForm((prev) => ({ ...prev, status }))}
                          disabled={!canManage}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <DialogFooter className="max-[1440px]:pt-2 max-[1440px]:pb-4">
              <Button
                type="button"
                variant="outline"
                className="max-[1440px]:h-8 max-[1440px]:px-3 max-[1440px]:text-xs"
                onClick={handleSettingsDone}
                disabled={saving}
              >
                {saving ? "Saving..." : "Done"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Homework Outline</CardTitle>
              <CardDescription>Drag sections and lessons to reorder. Lessons can move across sections.</CardDescription>
            </div>
            {showAddSection ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newSectionName}
                  onChange={(event) => setNewSectionName(event.target.value)}
                  placeholder="Input name"
                  className="w-56"
                  disabled={!canManage}
                />
                <Button variant="outline" onClick={() => { setShowAddSection(false); setNewSectionName(""); }} disabled={!canManage}>Cancel</Button>
                <Button onClick={handleCreateSection} disabled={!canManage}>Save</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleOpenStudentPreview} disabled={!editId}>
                  Preview
                </Button>
                <Button onClick={() => setShowAddSection(true)} disabled={!canManage}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Section
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {(form.sections || []).length === 0 ? (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Plus className="h-5 w-5" /></EmptyMedia>
                  <EmptyTitle>No sections yet</EmptyTitle>
                  <EmptyDescription>Create your first section to start building lesson outline.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => setShowAddSection(true)} disabled={!canManage}>New Section</Button>
                </EmptyContent>
              </Empty>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} autoScroll onDragEnd={handleDragEnd}>
                <SortableContext
                  items={(form.sections || []).map((section) => dndSectionId(section._id))}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {(form.sections || []).map((section) => (
                      <SortableSectionCard
                        key={section._id}
                        section={section}
                        canManage={canManage}
                        assignmentId={editId}
                        addingLessonSectionId={addingLessonSectionId}
                        newLessonName={newLessonName}
                        onNewLessonNameChange={setNewLessonName}
                        onShowAddLesson={(sectionId) => {
                          setAddingLessonSectionId(sectionId);
                          setNewLessonName("");
                        }}
                        onCancelAddLesson={() => {
                          setAddingLessonSectionId("");
                          setNewLessonName("");
                        }}
                        onCreateLesson={handleCreateLesson}
                        onTogglePublish={(checked) =>
                          updateSections((sections) =>
                            sections.map((item) =>
                              String(item._id) === String(section._id) ? { ...item, is_published: checked } : item,
                            ),
                          )}
                        onSectionMenuAction={(action) => {
                          if (action === "rename") {
                            openRenameDialog({
                              type: "section",
                              sectionId: section._id,
                              value: section.name,
                            });
                          }
                          if (action === "duplicate") duplicateSection(section._id);
                          if (action === "delete") {
                            openDeleteDialog({ type: "section", sectionId: section._id, label: section.name });
                          }
                        }}
                        onLessonTogglePublish={(lessonId, checked) =>
                          updateSections((sections) =>
                            sections.map((item) => ({
                              ...item,
                              lessons: (item.lessons || []).map((lesson) =>
                                String(item._id) === String(section._id) && String(lesson._id) === String(lessonId)
                                  ? { ...lesson, is_published: checked }
                                  : lesson,
                              ),
                            })),
                          )}
                        onLessonMenuAction={(lessonId, action) => {
                          const lesson = (section.lessons || []).find((item) => String(item._id) === String(lessonId));
                          if (!lesson) return;
                          if (action === "rename") {
                            openRenameDialog({
                              type: "lesson",
                              sectionId: section._id,
                              lessonId,
                              value: lesson.name,
                            });
                          }
                          if (action === "duplicate") duplicateLesson(section._id, lessonId);
                          if (action === "delete") {
                            openDeleteDialog({
                              type: "lesson",
                              sectionId: section._id,
                              lessonId,
                              label: lesson.name,
                            });
                          }
                        }}
                        onLessonDueDateChange={(lessonId, dueDate) =>
                          updateSections((sections) =>
                            sections.map((item) => ({
                              ...item,
                              lessons: (item.lessons || []).map((lesson) =>
                                String(item._id) === String(section._id) && String(lesson._id) === String(lessonId)
                                  ? { ...lesson, due_date: dueDate }
                                  : lesson,
                              ),
                            })),
                          )}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            {!editId ? (
              <>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Save assignment first to enable lesson links and auto-save outline to backend.
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>

        <AlertDialog open={deleteState.open} onOpenChange={(open) => setDeleteState((prev) => ({ ...prev, open }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteState.type || "item"}?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteState.type === "section"
                  ? `Section "${deleteState.label}" and its lesson submissions will be removed.`
                  : `Lesson "${deleteState.label}" and all submissions for this lesson will be removed.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={renameState.open} onOpenChange={(open) => setRenameState((prev) => ({ ...prev, open }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Rename {renameState.type === "section" ? "Section" : "Lesson"}
              </AlertDialogTitle>
              <AlertDialogDescription>Enter a new name.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={renameState.value}
              onChange={(event) => setRenameState((prev) => ({ ...prev, value: event.target.value }))}
              placeholder="Input name"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmRename}>Save</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

