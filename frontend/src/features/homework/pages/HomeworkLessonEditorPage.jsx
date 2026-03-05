import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, MoreVertical, Plus, Trash2, Upload, X } from "lucide-react";
import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import HomeworkRichTextEditor from "@/features/homework/components/HomeworkRichTextEditor";
import {
  GAPFILL_MODE_NUMBERED,
  GAPFILL_MODE_PARAGRAPH,
  normalizeFindMistakeBlockData,
  normalizeGapfillBlockData,
  parseGapfillTemplate,
} from "./gapfill.utils";
import DictationAudioPlayer from "./DictationAudioPlayer";
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

const HOMEWORK_RESOURCE_MAX_BYTES = 50 * 1024 * 1024;

const BLOCK_TYPES = [
  { type: "instruction", label: "Instruction" },
  { type: "video", label: "Video" },
  { type: "dictation", label: "Dictation" },
  { type: "input", label: "Input" },
  { type: "title", label: "Title" },
  { type: "passage", label: "Passage" },
  { type: "quiz", label: "Quiz" },
  { type: "matching", label: "Table Matching" },
  { type: "gapfill", label: "Gap Filling" },
  { type: "find_mistake", label: "Find Mistake" },
  { type: "internal", label: "Internal Content" },
];

const INPUT_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image Upload" },
  { value: "audio", label: "Audio Recording" },
];

const MATCH_COLOR_TOKENS = ["emerald", "sky", "amber", "fuchsia", "teal", "rose", "indigo", "lime"];

const MATCH_COLOR_CLASSES = {
  emerald: "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  sky: "border-sky-500 bg-sky-50 text-sky-700 hover:bg-sky-100",
  amber: "border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100",
  fuchsia: "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100",
  teal: "border-teal-500 bg-teal-50 text-teal-700 hover:bg-teal-100",
  rose: "border-rose-500 bg-rose-50 text-rose-700 hover:bg-rose-100",
  indigo: "border-indigo-500 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
  lime: "border-lime-500 bg-lime-50 text-lime-700 hover:bg-lime-100",
};

const normalizeBlockId = (value) => String(value || "").trim();

const resolveMatchColorToken = (value, fallbackIndex = 0) => {
  const normalized = String(value || "").trim();
  if (MATCH_COLOR_TOKENS.includes(normalized)) return normalized;
  return MATCH_COLOR_TOKENS[fallbackIndex % MATCH_COLOR_TOKENS.length];
};

const resolveMatchColorClass = (value, fallbackIndex = 0) =>
  MATCH_COLOR_CLASSES[resolveMatchColorToken(value, fallbackIndex)] || MATCH_COLOR_CLASSES.emerald;

const ensureBlockDataId = (data = {}) => {
  const base = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const blockId = normalizeBlockId(base.block_id) || createTempId();
  return { ...base, block_id: blockId };
};

const normalizePassageBlockData = (data = {}) => {
  const base = ensureBlockDataId(data);
  return {
    ...base,
    text: String(base.text || ""),
  };
};

const normalizeMatchingItemData = (item = {}, fallbackIndex = 0, side = "left") => ({
  id: normalizeBlockId(item?.id) || `${side}-${fallbackIndex + 1}`,
  text: String(item?.text || ""),
});

const normalizeMatchingBlockData = (data = {}) => {
  const base = ensureBlockDataId(data);
  const normalizedLeftItems = Array.isArray(base.left_items)
    ? base.left_items.map((item, index) => normalizeMatchingItemData(item, index, "left")).filter((item) => item.id)
    : [];
  const normalizedRightItems = Array.isArray(base.right_items)
    ? base.right_items.map((item, index) => normalizeMatchingItemData(item, index, "right")).filter((item) => item.id)
    : [];
  const normalizedRowCount = Math.max(normalizedLeftItems.length, normalizedRightItems.length, 2);
  const left_items = Array.from({ length: normalizedRowCount }, (_, index) =>
    normalizeMatchingItemData(normalizedLeftItems[index] || {}, index, "left"),
  );
  const right_items = Array.from({ length: normalizedRowCount }, (_, index) =>
    normalizeMatchingItemData(normalizedRightItems[index] || {}, index, "right"),
  );

  const leftIdSet = new Set(left_items.map((item) => item.id));
  const rightIdSet = new Set(right_items.map((item) => item.id));
  const rawMatches = Array.isArray(base.matches) ? base.matches : [];
  const usedLeft = new Set();
  const usedRight = new Set();
  const usedColors = new Set();
  const matches = [];

  rawMatches.forEach((pair, pairIndex) => {
    const leftId = normalizeBlockId(pair?.left_id);
    const rightId = normalizeBlockId(pair?.right_id);
    if (!leftId || !rightId) return;
    if (!leftIdSet.has(leftId) || !rightIdSet.has(rightId)) return;
    if (usedLeft.has(leftId) || usedRight.has(rightId)) return;

    let colorKey = resolveMatchColorToken(pair?.color_key, pairIndex);
    if (usedColors.has(colorKey)) {
      colorKey =
        MATCH_COLOR_TOKENS.find((token) => !usedColors.has(token))
        || MATCH_COLOR_TOKENS[matches.length % MATCH_COLOR_TOKENS.length];
    }

    usedLeft.add(leftId);
    usedRight.add(rightId);
    usedColors.add(colorKey);
    matches.push({
      left_id: leftId,
      right_id: rightId,
      color_key: colorKey,
    });
  });

  return {
    ...base,
    prompt: String(base.prompt || ""),
    left_items,
    right_items,
    matches,
  };
};

const normalizeQuizOptionData = (option = {}, fallbackIndex = 0) => ({
  id: normalizeBlockId(option?.id) || `option-${fallbackIndex + 1}`,
  text: String(option?.text || "").trim(),
});

const normalizeQuizQuestionData = (question = {}, fallbackIndex = 0) => {
  const normalizedQuestion = question && typeof question === "object" ? question : {};
  const normalizedOptions = Array.isArray(normalizedQuestion.options)
    ? normalizedQuestion.options
        .map((option, optionIndex) => normalizeQuizOptionData(option, optionIndex))
        .filter((option) => option.id)
    : [];
  const options = normalizedOptions.length >= 2
    ? normalizedOptions
    : [
        ...normalizedOptions,
        ...Array.from({ length: Math.max(0, 2 - normalizedOptions.length) }, (_, idx) =>
          normalizeQuizOptionData({}, normalizedOptions.length + idx),
        ),
      ];
  const optionIdSet = new Set(options.map((option) => option.id));
  const allowMultiple = Boolean(normalizedQuestion.allow_multiple);
  const requestedCorrectIds = Array.isArray(normalizedQuestion.correct_option_ids)
    ? normalizedQuestion.correct_option_ids
    : normalizedQuestion.correct_option_id
      ? [normalizedQuestion.correct_option_id]
      : [];
  const filteredCorrectIds = requestedCorrectIds
    .map((value) => normalizeBlockId(value))
    .filter((value) => optionIdSet.has(value));
  const uniqueCorrectIds = Array.from(new Set(filteredCorrectIds));

  return {
    id: normalizeBlockId(normalizedQuestion.id) || `question-${fallbackIndex + 1}`,
    question: String(normalizedQuestion.question || normalizedQuestion.text || "").trim(),
    explanation: String(normalizedQuestion.explanation || "").trim(),
    allow_multiple: allowMultiple,
    options,
    correct_option_ids: allowMultiple ? uniqueCorrectIds : uniqueCorrectIds.slice(0, 1),
  };
};

const normalizeQuizBlockData = (data = {}) => {
  const base = ensureBlockDataId(data);
  const {
    question: legacyQuestion,
    text: legacyText,
    options: legacyOptions,
    ...rest
  } = base;
  const hasLegacySingleQuestion =
    String(legacyQuestion || "").trim() !== ""
    || String(legacyText || "").trim() !== ""
    || (Array.isArray(legacyOptions) && legacyOptions.length > 0);
  const rawQuestions = Array.isArray(rest.questions) && rest.questions.length > 0
    ? rest.questions
    : hasLegacySingleQuestion
      ? [base]
      : [{}];
  const questions = rawQuestions.map((question, questionIndex) =>
    normalizeQuizQuestionData(question, questionIndex),
  );

  return {
    ...rest,
    parent_passage_block_id: normalizeBlockId(rest.parent_passage_block_id),
    questions,
  };
};

const resolveInputTypeFromData = (data = {}) => {
  const explicitType = String(data?.input_type || "").trim().toLowerCase();
  if (["text", "image", "audio"].includes(explicitType)) return explicitType;
  if (Boolean(data?.requires_audio)) return "audio";
  if (Boolean(data?.requires_image)) return "image";
  return "text";
};

const normalizeInputBlockData = (data = {}) => {
  const base = ensureBlockDataId(data);
  const inputType = resolveInputTypeFromData(data);
  const requiresText = inputType === "text";
  const requiresImage = inputType === "image";
  const requiresAudio = inputType === "audio";
  return {
    ...base,
    input_type: inputType,
    requires_text: requiresText,
    requires_image: requiresImage,
    requires_audio: requiresAudio,
    min_words: requiresText ? base?.min_words ?? "" : "",
    max_words: requiresText ? base?.max_words ?? "" : "",
  };
};

const normalizeDictationBlockData = (data = {}) => {
  const base = ensureBlockDataId(data);
  return {
    ...base,
    prompt: String(base.prompt || ""),
    audio_url: String(base.audio_url || base.url || ""),
    audio_storage_key: String(base.audio_storage_key || base.storage_key || ""),
    transcript: String(base.transcript || ""),
  };
};

const resolveBlockDataId = (block = {}) =>
  normalizeBlockId(block?.data?.block_id) || normalizeBlockId(block?.id);

const resolveQuizParentPassageId = (block = {}) => normalizeBlockId(block?.data?.parent_passage_block_id);

const createBlock = (type, data = {}) => {
  const baseData = ensureBlockDataId(data);
  if (type === "instruction") {
    return { id: createTempId(), type, data: { text: "", ...baseData } };
  }
  if (type === "video") {
    return { id: createTempId(), type, data: { url: "", ...baseData } };
  }
  if (type === "input") {
    return {
      id: createTempId(),
      type,
      data: normalizeInputBlockData({
        input_type: "text",
        min_words: "",
        max_words: "",
        ...baseData,
      }),
    };
  }
  if (type === "title") {
    return { id: createTempId(), type, data: { text: "", ...baseData } };
  }
  if (type === "passage") {
    return {
      id: createTempId(),
      type,
      data: normalizePassageBlockData({ text: "", ...baseData }),
    };
  }
  if (type === "quiz") {
    return {
      id: createTempId(),
      type,
      data: normalizeQuizBlockData(baseData),
    };
  }
  if (type === "matching") {
    return {
      id: createTempId(),
      type,
      data: normalizeMatchingBlockData(baseData),
    };
  }
  if (type === "gapfill") {
    return {
      id: createTempId(),
      type,
      data: normalizeGapfillBlockData(baseData),
    };
  }
  if (type === "find_mistake") {
    return {
      id: createTempId(),
      type,
      data: normalizeFindMistakeBlockData(baseData),
    };
  }
  if (type === "dictation") {
    return {
      id: createTempId(),
      type,
      data: normalizeDictationBlockData(baseData),
    };
  }
  return {
    id: createTempId(),
    type: "internal",
    data: {
      resource_ref_type: "passage",
      resource_ref_id: "",
      ...baseData,
    },
  };
};

const buildBlocksFromLesson = (lesson = {}) => {
  if (Array.isArray(lesson?.content_blocks)) {
    return lesson.content_blocks
      .slice()
      .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
      .map((block) => createBlock(block?.type || "instruction", block?.data || {}));
  }

  const hasLegacyFallbackData =
    String(lesson?.instruction || "").trim() !== ""
    || String(lesson?.resource_ref_id || "").trim() !== ""
    || String(lesson?.resource_url || "").trim() !== ""
    || Boolean(lesson?.requires_image)
    || Boolean(lesson?.requires_audio)
    || String(lesson?.min_words ?? "").trim() !== ""
    || String(lesson?.max_words ?? "").trim() !== "";

  if (!hasLegacyFallbackData) return [];

  const blocks = [];
  if (lesson.instruction) {
    blocks.push(createBlock("instruction", { text: lesson.instruction }));
  }
  if (lesson.resource_mode === "internal" && String(lesson.resource_ref_id || "").trim() !== "") {
    blocks.push(
      createBlock("internal", {
        resource_ref_type: lesson.resource_ref_type || "passage",
        resource_ref_id: lesson.resource_ref_id || "",
      }),
    );
  }
  if (
    (lesson.resource_mode === "external_url" || lesson.resource_mode === "uploaded")
    && String(lesson.resource_url || "").trim() !== ""
  ) {
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
  return blocks;
};

const applyBlocksToLesson = (lesson = {}, blocks = []) => {
  const next = { ...lesson };
  const normalizedBlocks = Array.isArray(blocks) ? blocks : [];
  const hasDictationBlock = normalizedBlocks.some((block) => String(block?.type || "").trim() === "dictation");
  const passageBlockIdSet = new Set(
    normalizedBlocks
      .filter((block) => String(block?.type || "").trim() === "passage")
      .map((block) => resolveBlockDataId(block))
      .filter(Boolean),
  );
  next.content_blocks = normalizedBlocks.map((block, index) => ({
    type: block?.type || "instruction",
    order: index,
    data: (() => {
      const blockType = String(block?.type || "").trim();
      if (blockType === "input") {
        return normalizeInputBlockData(block?.data || {});
      }
      if (blockType === "passage") {
        return normalizePassageBlockData(block?.data || {});
      }
      if (blockType === "quiz") {
        const normalizedQuiz = normalizeQuizBlockData(block?.data || {});
        const parentPassageId = normalizeBlockId(normalizedQuiz.parent_passage_block_id);
        return {
          ...normalizedQuiz,
          parent_passage_block_id:
            parentPassageId && passageBlockIdSet.has(parentPassageId) ? parentPassageId : "",
        };
      }
      if (blockType === "matching") {
        return normalizeMatchingBlockData(block?.data || {});
      }
      if (blockType === "gapfill") {
        return normalizeGapfillBlockData(block?.data || {});
      }
      if (blockType === "find_mistake") {
        return normalizeFindMistakeBlockData(block?.data || {});
      }
      if (blockType === "dictation") {
        return normalizeDictationBlockData(block?.data || {});
      }
      return ensureBlockDataId(block?.data || {});
    })(),
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
  } else if (hasDictationBlock) {
    next.requires_text = true;
    next.requires_image = false;
    next.requires_audio = false;
    next.min_words = "";
    next.max_words = "";
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
    next.resource_mode = lesson?.resource_mode || "internal";
    next.resource_ref_type = lesson?.resource_ref_type || "passage";
    next.resource_ref_id = lesson?.resource_ref_id || "";
    next.resource_url = lesson?.resource_url || "";
    next.resource_storage_key = lesson?.resource_storage_key || "";
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
    test: [],
  });
  const [searchKeyword, setSearchKeyword] = useState("");
  const [matchingSelections, setMatchingSelections] = useState({});
  const [dictationUploadLoadingByBlockId, setDictationUploadLoadingByBlockId] = useState({});
  const dictationFileInputRefs = useRef(new Map());

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [lessonRes, passageRes, sectionRes, speakingRes, writingRes, testRes] = await Promise.all([
        api.homeworkGetAssignmentLessonById(id, lessonId),
        api.getPassages({ summary: 1 }),
        api.getSections({ summary: 1 }),
        api.getSpeakings({ summary: 1, limit: 200 }),
        api.getWritings({ summary: 1 }),
        api.getTests({ summary: 1 }),
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
        test: Array.isArray(testRes?.data) ? testRes.data : [],
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
    ["passage", "section", "speaking", "writing", "test"].forEach((type) => {
      const list = catalog[type] || [];
      next[type] = !keyword
        ? list.slice(0, 40)
        : list
            .filter((item) => `${item?.title || ""} ${item?._id || ""}`.toLowerCase().includes(keyword))
            .slice(0, 40);
    });
    return next;
  }, [catalog, searchKeyword]);

  const passageBlockOptions = useMemo(() => {
    return contentBlocks
      .map((block, blockIndex) => {
        if (String(block?.type || "").trim() !== "passage") return null;
        const blockDataId = resolveBlockDataId(block);
        if (!blockDataId) return null;
        const previewText = String(block?.data?.text || "").trim();
        return {
          blockId: blockDataId,
          label: `${blockIndex + 1}. ${previewText ? previewText.slice(0, 36) : "Passage block"}`,
        };
      })
      .filter(Boolean);
  }, [contentBlocks]);

  const addBlock = (type) => {
    setContentBlocks((prev) => [...prev, createBlock(type)]);
  };

  const addQuizBlockForPassage = (passageBlockId) => {
    const normalizedPassageBlockId = normalizeBlockId(passageBlockId);
    if (!normalizedPassageBlockId) {
      setContentBlocks((prev) => [...prev, createBlock("quiz")]);
      return;
    }

    setContentBlocks((prev) => {
      const parentIndex = prev.findIndex((block) => resolveBlockDataId(block) === normalizedPassageBlockId);
      if (parentIndex < 0) return [...prev, createBlock("quiz")];
      let insertIndex = parentIndex + 1;
      while (
        insertIndex < prev.length
        && String(prev[insertIndex]?.type || "").trim() === "quiz"
        && resolveQuizParentPassageId(prev[insertIndex]) === normalizedPassageBlockId
      ) {
        insertIndex += 1;
      }
      const next = [...prev];
      next.splice(insertIndex, 0, createBlock("quiz", { parent_passage_block_id: normalizedPassageBlockId }));
      return next;
    });
  };

  const updateQuizBlock = (blockId, updater) => {
    setContentBlocks((prev) =>
      prev.map((block) => {
        if (String(block.id) !== String(blockId)) return block;
        const currentData = normalizeQuizBlockData(block?.data || {});
        const nextData =
          typeof updater === "function"
            ? normalizeQuizBlockData(updater(currentData))
            : normalizeQuizBlockData({ ...currentData, ...(updater || {}) });
        return {
          ...block,
          data: nextData,
        };
      }),
    );
  };

  const addQuizQuestion = (blockId) => {
    updateQuizBlock(blockId, (currentData) => ({
      ...currentData,
      questions: [...(Array.isArray(currentData.questions) ? currentData.questions : []), {}],
    }));
  };

  const removeQuizQuestion = (blockId, questionId) => {
    const normalizedQuestionId = normalizeBlockId(questionId);
    updateQuizBlock(blockId, (currentData) => {
      const currentQuestions = Array.isArray(currentData.questions) ? currentData.questions : [];
      if (currentQuestions.length <= 1) return currentData;
      return {
        ...currentData,
        questions: currentQuestions.filter((question) => normalizeBlockId(question?.id) !== normalizedQuestionId),
      };
    });
  };

  const updateQuizQuestion = (blockId, questionId, updater) => {
    const normalizedQuestionId = normalizeBlockId(questionId);
    updateQuizBlock(blockId, (currentData) => ({
      ...currentData,
      questions: (Array.isArray(currentData.questions) ? currentData.questions : []).map((question, questionIndex) => {
        if (normalizeBlockId(question?.id) !== normalizedQuestionId) return question;
        const nextQuestion =
          typeof updater === "function" ? updater(question, questionIndex) : { ...question, ...(updater || {}) };
        return nextQuestion;
      }),
    }));
  };

  const addQuizOption = (blockId, questionId) => {
    updateQuizBlock(blockId, (currentData) => ({
      ...currentData,
      questions: (Array.isArray(currentData.questions) ? currentData.questions : []).map((question) =>
        normalizeBlockId(question?.id) === normalizeBlockId(questionId)
          ? {
              ...question,
              options: [...(Array.isArray(question.options) ? question.options : []), { id: createTempId(), text: "" }],
            }
          : question,
      ),
    }));
  };

  const removeQuizOption = (blockId, questionId, optionId) => {
    const normalizedOptionId = normalizeBlockId(optionId);
    updateQuizBlock(blockId, (currentData) => {
      return {
        ...currentData,
        questions: (Array.isArray(currentData.questions) ? currentData.questions : []).map((question) => {
          if (normalizeBlockId(question?.id) !== normalizeBlockId(questionId)) return question;
          const currentOptions = Array.isArray(question.options) ? question.options : [];
          const nextOptions = currentOptions.filter(
            (option) => normalizeBlockId(option?.id) !== normalizedOptionId,
          );
          if (nextOptions.length < 2) return question;
          return {
            ...question,
            options: nextOptions,
            correct_option_ids: (Array.isArray(question.correct_option_ids) ? question.correct_option_ids : []).filter(
              (currentOptionId) => normalizeBlockId(currentOptionId) !== normalizedOptionId,
            ),
          };
        }),
      };
    });
  };

  const toggleQuizCorrectOption = (blockId, questionId, optionId) => {
    updateQuizQuestion(blockId, questionId, (question) => {
      const normalizedOptionId = normalizeBlockId(optionId);
      const currentCorrectIds = Array.isArray(question?.correct_option_ids)
        ? question.correct_option_ids.map((value) => normalizeBlockId(value))
        : [];
      const exists = currentCorrectIds.includes(normalizedOptionId);
      if (question?.allow_multiple) {
        const nextCorrectIds = exists
          ? currentCorrectIds.filter((value) => value !== normalizedOptionId)
          : [...currentCorrectIds, normalizedOptionId];
        return { ...question, correct_option_ids: nextCorrectIds };
      }
      return {
        ...question,
        correct_option_ids: exists ? [] : [normalizedOptionId],
      };
    });
  };

  const updateQuizQuestionOptionText = (blockId, questionId, optionId, textValue) => {
    updateQuizQuestion(blockId, questionId, (question) => ({
      ...question,
      options: (Array.isArray(question?.options) ? question.options : []).map((option) =>
        normalizeBlockId(option?.id) === normalizeBlockId(optionId)
          ? { ...option, text: textValue }
          : option,
      ),
    }));
  };

  const updateQuizQuestionAllowMultiple = (blockId, questionId, checked) => {
    updateQuizQuestion(blockId, questionId, (question) => ({
      ...question,
      allow_multiple: Boolean(checked),
      correct_option_ids: Boolean(checked)
        ? (Array.isArray(question?.correct_option_ids) ? question.correct_option_ids : [])
        : (Array.isArray(question?.correct_option_ids) ? question.correct_option_ids : []).slice(0, 1),
    }));
  };

  const updateQuizQuestionField = (blockId, questionId, patch = {}) => {
    updateQuizQuestion(blockId, questionId, (question) => ({
      ...question,
      ...patch,
    }));
  };

  const resolveQuizQuestions = (quizData = {}) =>
    (Array.isArray(quizData?.questions) ? quizData.questions : []).map((question, questionIndex) =>
      normalizeQuizQuestionData(question, questionIndex),
    );

  const updateDictationBlock = (blockId, updater) => {
    setContentBlocks((prev) =>
      prev.map((block) => {
        if (String(block.id) !== String(blockId)) return block;
        const currentData = normalizeDictationBlockData(block?.data || {});
        const nextData =
          typeof updater === "function"
            ? normalizeDictationBlockData(updater(currentData))
            : normalizeDictationBlockData({ ...currentData, ...(updater || {}) });
        return {
          ...block,
          data: nextData,
        };
      }),
    );
  };

  const setDictationUploadLoading = (blockId, nextLoading) => {
    const normalizedBlockId = String(blockId || "");
    setDictationUploadLoadingByBlockId((prev) => ({
      ...prev,
      [normalizedBlockId]: Boolean(nextLoading),
    }));
  };

  const registerDictationFileInputRef = (blockId, node) => {
    const normalizedBlockId = String(blockId || "");
    if (!normalizedBlockId) return;
    if (!node) {
      dictationFileInputRefs.current.delete(normalizedBlockId);
      return;
    }
    dictationFileInputRefs.current.set(normalizedBlockId, node);
  };

  const openDictationUploadPicker = (blockId) => {
    const normalizedBlockId = String(blockId || "");
    dictationFileInputRefs.current.get(normalizedBlockId)?.click();
  };

  const handleDictationAudioFileSelected = async (blockId, event) => {
    const file = event.target?.files?.[0];
    const resetInput = () => {
      if (event?.target) event.target.value = "";
    };
    if (!file) {
      resetInput();
      return;
    }

    if (!String(file.type || "").toLowerCase().startsWith("audio/")) {
      showNotification("Only audio files are allowed.", "error");
      resetInput();
      return;
    }

    if (file.size > HOMEWORK_RESOURCE_MAX_BYTES) {
      showNotification("Audio file must be 50MB or smaller.", "error");
      resetInput();
      return;
    }

    setDictationUploadLoading(blockId, true);
    try {
      const formData = new FormData();
      formData.append("resource", file);
      if (String(id || "").trim()) {
        formData.append("assignment_id", String(id || "").trim());
      }
      if (String(lessonId || "").trim()) {
        formData.append("task_id", String(lessonId || "").trim());
      }
      const response = await api.uploadHomeworkResource(formData);
      const uploadedUrl = String(response?.data?.url || "").trim();
      const uploadedKey = String(response?.data?.key || "").trim();

      if (!uploadedUrl || !uploadedKey) {
        throw new Error("Upload succeeded but missing url/key.");
      }

      updateDictationBlock(blockId, (currentData) => ({
        ...currentData,
        audio_url: uploadedUrl,
        audio_storage_key: uploadedKey,
      }));
      showNotification("Dictation audio uploaded.", "success");
    } catch (uploadError) {
      showNotification(uploadError?.message || "Failed to upload dictation audio.", "error");
    } finally {
      setDictationUploadLoading(blockId, false);
      resetInput();
    }
  };

  const updateGapfillBlock = (blockId, updater) => {
    setContentBlocks((prev) =>
      prev.map((block) => {
        if (String(block.id) !== String(blockId)) return block;
        const currentData = normalizeGapfillBlockData(block?.data || {});
        const nextData =
          typeof updater === "function"
            ? normalizeGapfillBlockData(updater(currentData))
            : normalizeGapfillBlockData({ ...currentData, ...(updater || {}) });
        return {
          ...block,
          data: nextData,
        };
      }),
    );
  };

  const addGapfillNumberedItem = (blockId) => {
    updateGapfillBlock(blockId, (currentData) => ({
      ...currentData,
      numbered_items: [...(Array.isArray(currentData.numbered_items) ? currentData.numbered_items : []), ""],
    }));
  };

  const removeGapfillNumberedItem = (blockId, itemIndex) => {
    updateGapfillBlock(blockId, (currentData) => {
      const items = Array.isArray(currentData.numbered_items) ? currentData.numbered_items : [];
      if (items.length <= 1) return currentData;
      return {
        ...currentData,
        numbered_items: items.filter((_, index) => index !== itemIndex),
      };
    });
  };

  const updateGapfillNumberedItemText = (blockId, itemIndex, value) => {
    updateGapfillBlock(blockId, (currentData) => ({
      ...currentData,
      numbered_items: (Array.isArray(currentData.numbered_items) ? currentData.numbered_items : []).map((item, index) =>
        index === itemIndex ? value : item,
      ),
    }));
  };

  const updateFindMistakeBlock = (blockId, updater) => {
    setContentBlocks((prev) =>
      prev.map((block) => {
        if (String(block.id) !== String(blockId)) return block;
        const currentData = normalizeFindMistakeBlockData(block?.data || {});
        const nextData =
          typeof updater === "function"
            ? normalizeFindMistakeBlockData(updater(currentData))
            : normalizeFindMistakeBlockData({ ...currentData, ...(updater || {}) });
        return {
          ...block,
          data: nextData,
        };
      }),
    );
  };

  const addFindMistakeSentence = (blockId) => {
    updateFindMistakeBlock(blockId, (currentData) => ({
      ...currentData,
      numbered_items: [...(Array.isArray(currentData.numbered_items) ? currentData.numbered_items : []), ""],
    }));
  };

  const removeFindMistakeSentence = (blockId, itemIndex) => {
    updateFindMistakeBlock(blockId, (currentData) => {
      const items = Array.isArray(currentData.numbered_items) ? currentData.numbered_items : [];
      if (items.length <= 1) return currentData;
      return {
        ...currentData,
        numbered_items: items.filter((_, index) => index !== itemIndex),
      };
    });
  };

  const updateFindMistakeSentenceText = (blockId, itemIndex, value) => {
    updateFindMistakeBlock(blockId, (currentData) => ({
      ...currentData,
      numbered_items: (Array.isArray(currentData.numbered_items) ? currentData.numbered_items : []).map((item, index) =>
        index === itemIndex ? value : item,
      ),
    }));
  };

  const updateMatchingBlock = (blockId, updater) => {
    setContentBlocks((prev) =>
      prev.map((block) => {
        if (String(block.id) !== String(blockId)) return block;
        const currentData = normalizeMatchingBlockData(block?.data || {});
        const nextData =
          typeof updater === "function"
            ? normalizeMatchingBlockData(updater(currentData))
            : normalizeMatchingBlockData({ ...currentData, ...(updater || {}) });
        return {
          ...block,
          data: nextData,
        };
      }),
    );
  };

  const addMatchingRow = (blockId) => {
    updateMatchingBlock(blockId, (currentData) => ({
      ...currentData,
      left_items: [...(Array.isArray(currentData.left_items) ? currentData.left_items : []), {}],
      right_items: [...(Array.isArray(currentData.right_items) ? currentData.right_items : []), {}],
    }));
  };

  const removeMatchingRow = (blockId, rowIndex) => {
    const currentBlock = contentBlocks.find((item) => String(item.id) === String(blockId));
    const currentMatchingData = normalizeMatchingBlockData(currentBlock?.data || {});
    const removedLeftId = normalizeBlockId((currentMatchingData.left_items || [])[rowIndex]?.id);

    updateMatchingBlock(blockId, (currentData) => {
      const currentLeftItems = Array.isArray(currentData.left_items) ? currentData.left_items : [];
      const currentRightItems = Array.isArray(currentData.right_items) ? currentData.right_items : [];
      const currentRowCount = Math.max(currentLeftItems.length, currentRightItems.length);
      if (currentRowCount <= 1) return currentData;
      if (rowIndex < 0 || rowIndex >= currentRowCount) return currentData;

      const removedLeftId = normalizeBlockId(currentLeftItems[rowIndex]?.id);
      const removedRightId = normalizeBlockId(currentRightItems[rowIndex]?.id);
      const nextLeftItems = currentLeftItems.filter((_, index) => index !== rowIndex);
      const nextRightItems = currentRightItems.filter((_, index) => index !== rowIndex);
      const nextMatches = (Array.isArray(currentData.matches) ? currentData.matches : []).filter(
        (pair) =>
          normalizeBlockId(pair?.left_id) !== removedLeftId
          && normalizeBlockId(pair?.right_id) !== removedRightId,
      );

      return {
        ...currentData,
        left_items: nextLeftItems,
        right_items: nextRightItems,
        matches: nextMatches,
      };
    });

    setMatchingSelections((prev) => {
      const selectedLeft = normalizeBlockId(prev[String(blockId)]);
      if (selectedLeft !== removedLeftId) return prev;
      return {
        ...prev,
        [String(blockId)]: "",
      };
    });
  };

  const updateMatchingItemText = (blockId, side, itemId, textValue) => {
    const normalizedItemId = normalizeBlockId(itemId);
    const key = side === "right" ? "right_items" : "left_items";
    updateMatchingBlock(blockId, (currentData) => ({
      ...currentData,
      [key]: (Array.isArray(currentData[key]) ? currentData[key] : []).map((item) =>
        normalizeBlockId(item?.id) === normalizedItemId ? { ...item, text: textValue } : item,
      ),
    }));
  };

  const getNextMatchingColorToken = (matches = []) => {
    const usedColorKeys = new Set(
      (Array.isArray(matches) ? matches : [])
        .map((pair) => resolveMatchColorToken(pair?.color_key))
        .filter(Boolean),
    );
    return (
      MATCH_COLOR_TOKENS.find((token) => !usedColorKeys.has(token))
      || MATCH_COLOR_TOKENS[(Array.isArray(matches) ? matches.length : 0) % MATCH_COLOR_TOKENS.length]
    );
  };

  const handleMatchingLeftCellClick = (blockId, leftItemId) => {
    const normalizedLeftItemId = normalizeBlockId(leftItemId);
    if (!normalizedLeftItemId) return;
    const selectedLeft = normalizeBlockId(matchingSelections[String(blockId)]);
    if (selectedLeft === normalizedLeftItemId) {
      setMatchingSelections((prev) => ({
        ...prev,
        [String(blockId)]: "",
      }));
      return;
    }

    let removedLinkedPair = false;
    updateMatchingBlock(blockId, (currentData) => {
      const currentMatches = Array.isArray(currentData.matches) ? currentData.matches : [];
      if (!currentMatches.some((pair) => normalizeBlockId(pair?.left_id) === normalizedLeftItemId)) {
        return currentData;
      }
      removedLinkedPair = true;
      return {
        ...currentData,
        matches: currentMatches.filter((pair) => normalizeBlockId(pair?.left_id) !== normalizedLeftItemId),
      };
    });

    setMatchingSelections((prev) => ({
      ...prev,
      [String(blockId)]: removedLinkedPair ? "" : normalizedLeftItemId,
    }));
  };

  const handleMatchingRightCellClick = (blockId, rightItemId) => {
    const normalizedRightItemId = normalizeBlockId(rightItemId);
    if (!normalizedRightItemId) return;
    const selectedLeft = normalizeBlockId(matchingSelections[String(blockId)]);

    updateMatchingBlock(blockId, (currentData) => {
      const currentMatches = Array.isArray(currentData.matches) ? currentData.matches : [];

      if (!selectedLeft) {
        if (!currentMatches.some((pair) => normalizeBlockId(pair?.right_id) === normalizedRightItemId)) {
          return currentData;
        }
        return {
          ...currentData,
          matches: currentMatches.filter((pair) => normalizeBlockId(pair?.right_id) !== normalizedRightItemId),
        };
      }

      const hasExactPair = currentMatches.some(
        (pair) =>
          normalizeBlockId(pair?.left_id) === selectedLeft
          && normalizeBlockId(pair?.right_id) === normalizedRightItemId,
      );
      if (hasExactPair) {
        return {
          ...currentData,
          matches: currentMatches.filter(
            (pair) =>
              !(
                normalizeBlockId(pair?.left_id) === selectedLeft
                && normalizeBlockId(pair?.right_id) === normalizedRightItemId
              ),
          ),
        };
      }

      const filteredMatches = currentMatches.filter(
        (pair) =>
          normalizeBlockId(pair?.left_id) !== selectedLeft
          && normalizeBlockId(pair?.right_id) !== normalizedRightItemId,
      );

      return {
        ...currentData,
        matches: [
          ...filteredMatches,
          {
            left_id: selectedLeft,
            right_id: normalizedRightItemId,
            color_key: getNextMatchingColorToken(filteredMatches),
          },
        ],
      };
    });

    if (selectedLeft) {
      setMatchingSelections((prev) => ({
        ...prev,
        [String(blockId)]: "",
      }));
    }
  };

  const removeBlock = (blockId) => {
    const normalizedBlockId = String(blockId || "");
    dictationFileInputRefs.current.delete(normalizedBlockId);
    setDictationUploadLoadingByBlockId((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, normalizedBlockId)) return prev;
      const next = { ...prev };
      delete next[normalizedBlockId];
      return next;
    });

    setMatchingSelections((prev) => {
      const key = String(blockId);
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

    setContentBlocks((prev) => {
      const removedBlock = prev.find((block) => String(block.id) === String(blockId));
      const removedPassageBlockId =
        String(removedBlock?.type || "").trim() === "passage" ? resolveBlockDataId(removedBlock) : "";
      const remaining = prev.filter((block) => String(block.id) !== String(blockId));
      if (!removedPassageBlockId) return remaining;
      return remaining.map((block) => {
        if (String(block?.type || "").trim() !== "quiz") return block;
        if (resolveQuizParentPassageId(block) !== removedPassageBlockId) return block;
        return {
          ...block,
          data: normalizeQuizBlockData({
            ...(block?.data || {}),
            parent_passage_block_id: "",
          }),
        };
      });
    });
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
    window.open(`/student-ielts/homework/${id}?preview=1`, "_blank", "noopener,noreferrer");
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
                {contentBlocks.map((block, index) => {
                  const blockType = String(block?.type || "").trim();
                  const blockTypeLabel = BLOCK_TYPES.find((item) => item.type === blockType)?.label || "Block";
                  const blockDataId = resolveBlockDataId(block);
                  const passageTextPreview = blockType === "passage" ? String(block?.data?.text || "").trim() : "";
                  const dictationData = blockType === "dictation" ? normalizeDictationBlockData(block?.data || {}) : null;
                  const isDictationUploadLoading = Boolean(dictationUploadLoadingByBlockId[String(block.id)]);
                  const quizData = blockType === "quiz" ? normalizeQuizBlockData(block?.data || {}) : null;
                  const quizQuestions = blockType === "quiz" ? resolveQuizQuestions(quizData) : [];
                  const quizParentPassageId = normalizeBlockId(quizData?.parent_passage_block_id);
                  const matchingData = blockType === "matching" ? normalizeMatchingBlockData(block?.data || {}) : null;
                  const matchingLeftItems = Array.isArray(matchingData?.left_items) ? matchingData.left_items : [];
                  const matchingRightItems = Array.isArray(matchingData?.right_items) ? matchingData.right_items : [];
                  const matchingPairs = Array.isArray(matchingData?.matches) ? matchingData.matches : [];
                  const matchingSelectedLeftId = normalizeBlockId(matchingSelections[String(block.id)]);
                  const gapfillData = blockType === "gapfill" ? normalizeGapfillBlockData(block?.data || {}) : null;
                  const gapfillTemplates = blockType === "gapfill"
                    ? (
                        gapfillData?.mode === GAPFILL_MODE_PARAGRAPH
                          ? [String(gapfillData?.paragraph_text || "")]
                          : (Array.isArray(gapfillData?.numbered_items) ? gapfillData.numbered_items : [])
                      )
                    : [];
                  const findMistakeData = blockType === "find_mistake"
                    ? normalizeFindMistakeBlockData(block?.data || {})
                    : null;
                  const findMistakeTemplates = blockType === "find_mistake"
                    ? (Array.isArray(findMistakeData?.numbered_items) ? findMistakeData.numbered_items : [])
                    : [];
                  const matchingPairByLeftId = new Map(
                    matchingPairs.map((pair, pairIndex) => [
                      normalizeBlockId(pair?.left_id),
                      { ...pair, __pairIndex: pairIndex },
                    ]),
                  );
                  const matchingPairByRightId = new Map(
                    matchingPairs.map((pair, pairIndex) => [
                      normalizeBlockId(pair?.right_id),
                      { ...pair, __pairIndex: pairIndex },
                    ]),
                  );

                  return (
                    <div key={block.id} className="space-y-3 rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {index + 1}. {blockTypeLabel}
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

                      {blockType === "title" ? (
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input
                            value={block.data.text || ""}
                            onChange={(event) => updateBlockData(block.id, { text: event.target.value })}
                            placeholder="Add heading text"
                          />
                        </div>
                      ) : null}

                      {blockType === "instruction" ? (
                        <div className="space-y-2">
                          <Label>Instruction</Label>
                          <HomeworkRichTextEditor
                            value={block.data.text || ""}
                            onChange={(nextText) => updateBlockData(block.id, { text: nextText })}
                            placeholder="Add instruction for students..."
                            minHeight={150}
                          />
                        </div>
                      ) : null}

                      {blockType === "video" ? (
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
                                  This URL does not support embed preview.{" "}
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

                      {blockType === "dictation" ? (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>Prompt (optional)</Label>
                            <Input
                              value={dictationData?.prompt || ""}
                              onChange={(event) =>
                                updateDictationBlock(block.id, {
                                  ...(dictationData || {}),
                                  prompt: event.target.value,
                                })}
                              placeholder="Example: Listen and type exactly what you hear"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Audio (MP3)</Label>
                            <Input
                              ref={(node) => registerDictationFileInputRef(block.id, node)}
                              type="file"
                              accept="audio/*"
                              onChange={(event) => void handleDictationAudioFileSelected(block.id, event)}
                              className="hidden"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => openDictationUploadPicker(block.id)}
                                disabled={isDictationUploadLoading}
                              >
                                <Upload className="h-4 w-4" />
                                {isDictationUploadLoading
                                  ? "Uploading..."
                                  : dictationData?.audio_url
                                    ? "Replace Audio"
                                    : "Upload Audio"}
                              </Button>
                              <span className="text-xs text-muted-foreground">Max file size: 50MB</span>
                            </div>
                            <Input
                              value={dictationData?.audio_url || ""}
                              onChange={(event) =>
                                updateDictationBlock(block.id, {
                                  ...(dictationData || {}),
                                  audio_url: event.target.value,
                                  audio_storage_key: "",
                                })}
                              placeholder="https://example.com/dictation.mp3"
                            />
                            <p className="text-xs text-muted-foreground">
                              Editing URL manually clears storage key to avoid deleting external audio.
                            </p>
                            {dictationData?.audio_url ? (
                              <div className="space-y-2">
                                <DictationAudioPlayer
                                  src={dictationData.audio_url}
                                  title={dictationData?.prompt || `Dictation ${index + 1}`}
                                />
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateDictationBlock(block.id, {
                                        ...(dictationData || {}),
                                        audio_url: "",
                                        audio_storage_key: "",
                                      })}
                                  >
                                    <X className="h-4 w-4" />
                                    Clear audio
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label>Transcript (teacher only)</Label>
                            <HomeworkRichTextEditor
                              value={dictationData?.transcript || ""}
                              onChange={(nextText) =>
                                updateDictationBlock(block.id, {
                                  ...(dictationData || {}),
                                  transcript: nextText,
                                })}
                              placeholder="Transcript will be hidden from students."
                              minHeight={140}
                            />
                            <p className="text-xs text-muted-foreground">
                              Students will only see the audio and submission input.
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {blockType === "input" ? (
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

                      {blockType === "passage" ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <Label>Passage Content</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addQuizBlockForPassage(blockDataId)}
                              disabled={!blockDataId}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add quiz question
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Label>Passage Text</Label>
                            <HomeworkRichTextEditor
                              value={block?.data?.text || ""}
                              onChange={(nextText) =>
                                updateBlockData(
                                  block.id,
                                  normalizePassageBlockData({
                                    ...(block?.data || {}),
                                    text: nextText,
                                  }),
                                )}
                              placeholder="Type the reading passage here..."
                              minHeight={240}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {passageTextPreview
                              ? `${passageTextPreview.length} characters`
                              : "Passage is empty."}
                          </p>
                        </div>
                      ) : null}

                      {blockType === "quiz" ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Attach to passage (optional)</Label>
                              <Select
                                value={quizParentPassageId || "__standalone__"}
                                onValueChange={(value) =>
                                  updateQuizBlock(block.id, {
                                    parent_passage_block_id: value === "__standalone__" ? "" : value,
                                  })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__standalone__">Standalone quiz</SelectItem>
                                  {passageBlockOptions.map((option) => (
                                    <SelectItem key={option.blockId} value={option.blockId}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {quizParentPassageId
                                  ? "This quiz is treated as a reading question for the selected passage."
                                  : "This quiz will be shown as a normal standalone quiz block."}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <Label>Questions</Label>
                            <Button type="button" variant="outline" size="sm" onClick={() => addQuizQuestion(block.id)}>
                              <Plus className="h-3.5 w-3.5" />
                              Add question
                            </Button>
                          </div>
                          {quizQuestions.map((quizQuestion, questionIndex) => {
                            const questionId = normalizeBlockId(quizQuestion?.id) || `${block.id}-q-${questionIndex}`;
                            const questionOptions = Array.isArray(quizQuestion?.options) ? quizQuestion.options : [];
                            return (
                              <div key={questionId} className="space-y-3 rounded-md border p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium">Question {questionIndex + 1}</p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeQuizQuestion(block.id, questionId)}
                                    disabled={quizQuestions.length <= 1}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  <Label>Question Text</Label>
                                  <HomeworkRichTextEditor
                                    value={quizQuestion?.question || ""}
                                    onChange={(nextText) =>
                                      updateQuizQuestionField(block.id, questionId, { question: nextText })}
                                    placeholder="Type your quiz question..."
                                    minHeight={130}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Allow multiple correct answers</Label>
                                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                    <Switch
                                      checked={Boolean(quizQuestion?.allow_multiple)}
                                      onCheckedChange={(checked) =>
                                        updateQuizQuestionAllowMultiple(block.id, questionId, checked)}
                                    />
                                    <span className="text-sm text-muted-foreground">
                                      {quizQuestion?.allow_multiple ? "Multi-select" : "Single-select"}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <Label>Options</Label>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => addQuizOption(block.id, questionId)}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Add option
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    {questionOptions.map((option, optionIndex) => {
                                      const optionId = normalizeBlockId(option?.id);
                                      const isCorrect = (quizQuestion?.correct_option_ids || []).includes(optionId);
                                      return (
                                        <div
                                          key={optionId || `${questionId}-option-${optionIndex}`}
                                          className="rounded-md border p-2"
                                        >
                                          <div className="flex items-start gap-2">
                                            <Button
                                              type="button"
                                              variant={isCorrect ? "default" : "outline"}
                                              size="sm"
                                              className="shrink-0"
                                              onClick={() => toggleQuizCorrectOption(block.id, questionId, optionId)}
                                            >
                                              {isCorrect ? "Correct" : "Mark"}
                                            </Button>
                                            <Input
                                              value={option?.text || ""}
                                              onChange={(event) =>
                                                updateQuizQuestionOptionText(
                                                  block.id,
                                                  questionId,
                                                  optionId,
                                                  event.target.value,
                                                )}
                                              placeholder={`Option ${optionIndex + 1}`}
                                            />
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => removeQuizOption(block.id, questionId, optionId)}
                                              disabled={questionOptions.length <= 2}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Explanation (optional)</Label>
                                  <HomeworkRichTextEditor
                                    value={quizQuestion?.explanation || ""}
                                    onChange={(nextText) =>
                                      updateQuizQuestionField(block.id, questionId, { explanation: nextText })}
                                    placeholder="Add explanation shown in review mode (optional)"
                                    minHeight={120}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {blockType === "matching" ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Prompt (optional)</Label>
                            <Input
                              value={matchingData?.prompt || ""}
                              onChange={(event) =>
                                updateMatchingBlock(block.id, {
                                  ...(matchingData || {}),
                                  prompt: event.target.value,
                                })}
                              placeholder="Example: Match each term with its definition"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <Label>Rows</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addMatchingRow(block.id)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add row
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {matchingLeftItems.map((leftItem, rowIndex) => {
                              const rightItem = matchingRightItems[rowIndex] || {};
                              const leftItemId = normalizeBlockId(leftItem?.id) || `left-${rowIndex + 1}`;
                              const rightItemId = normalizeBlockId(rightItem?.id) || `right-${rowIndex + 1}`;
                              const linkedLeftPair = matchingPairByLeftId.get(leftItemId);
                              const linkedRightPair = matchingPairByRightId.get(rightItemId);
                              const isSelectedLeft = matchingSelectedLeftId === leftItemId;
                              const leftColorClass = linkedLeftPair
                                ? resolveMatchColorClass(linkedLeftPair?.color_key, linkedLeftPair?.__pairIndex || 0)
                                : "";
                              const rightColorClass = linkedRightPair
                                ? resolveMatchColorClass(linkedRightPair?.color_key, linkedRightPair?.__pairIndex || 0)
                                : "";
                              const canLinkRight = Boolean(matchingSelectedLeftId) || Boolean(linkedRightPair);

                              return (
                                <div key={`matching-row-${block.id}-${rowIndex}`} className="rounded-md border p-2">
                                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_auto]">
                                    <div className="flex items-start gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className={`shrink-0 ${linkedLeftPair ? leftColorClass : isSelectedLeft ? "border-primary bg-primary/10 text-primary" : ""}`}
                                        onClick={() => handleMatchingLeftCellClick(block.id, leftItemId)}
                                      >
                                        {linkedLeftPair ? "Unlink" : isSelectedLeft ? "Selected" : "Select"}
                                      </Button>
                                      <Input
                                        value={leftItem?.text || ""}
                                        onChange={(event) =>
                                          updateMatchingItemText(block.id, "left", leftItemId, event.target.value)}
                                        placeholder={`Left item ${rowIndex + 1}`}
                                      />
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className={`shrink-0 ${linkedRightPair ? rightColorClass : ""}`}
                                        onClick={() => handleMatchingRightCellClick(block.id, rightItemId)}
                                        disabled={!canLinkRight}
                                      >
                                        {linkedRightPair ? "Unlink" : matchingSelectedLeftId ? "Link" : "Pick left"}
                                      </Button>
                                      <Input
                                        value={rightItem?.text || ""}
                                        onChange={(event) =>
                                          updateMatchingItemText(block.id, "right", rightItemId, event.target.value)}
                                        placeholder={`Right item ${rowIndex + 1}`}
                                      />
                                    </div>
                                    <div className="flex items-center justify-end">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeMatchingRow(block.id, rowIndex)}
                                        disabled={matchingLeftItems.length <= 1}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Click a left item to select it, then click a right item to create a matching pair. Click an
                            already linked item to remove that link.
                          </p>
                        </div>
                      ) : null}

                      {blockType === "gapfill" ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Instruction (optional)</Label>
                            <Input
                              value={gapfillData?.prompt || ""}
                              onChange={(event) =>
                                updateGapfillBlock(block.id, {
                                  ...(gapfillData || {}),
                                  prompt: event.target.value,
                                })}
                              placeholder="Example: Fill in the blanks with the correct words"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Gapfilling type</Label>
                            <Select
                              value={gapfillData?.mode || GAPFILL_MODE_NUMBERED}
                              onValueChange={(value) =>
                                updateGapfillBlock(block.id, {
                                  ...(gapfillData || {}),
                                  mode: value,
                                })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={GAPFILL_MODE_NUMBERED}>Numbered Sentences</SelectItem>
                                <SelectItem value={GAPFILL_MODE_PARAGRAPH}>Paragraph</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {gapfillData?.mode === GAPFILL_MODE_PARAGRAPH ? (
                            <div className="space-y-2">
                              <Label>Paragraph</Label>
                              <HomeworkRichTextEditor
                                value={gapfillData?.paragraph_text || ""}
                                onChange={(nextText) =>
                                  updateGapfillBlock(block.id, {
                                    ...(gapfillData || {}),
                                    paragraph_text: nextText,
                                  })}
                                placeholder="Example: The ocean is full of [*fish / cats / dogs] and the water is [blue]."
                                minHeight={180}
                              />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <Label>Sentences</Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addGapfillNumberedItem(block.id)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Add sentence
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {(Array.isArray(gapfillData?.numbered_items) ? gapfillData.numbered_items : []).map((item, itemIndex) => (
                                  <div key={`gapfill-item-${block.id}-${itemIndex}`} className="rounded-md border p-2">
                                    <div className="flex items-start gap-2">
                                      <span className="pt-2 text-xs font-medium text-muted-foreground">{itemIndex + 1}.</span>
                                      <Textarea
                                        value={item || ""}
                                        onChange={(event) =>
                                          updateGapfillNumberedItemText(block.id, itemIndex, event.target.value)}
                                        placeholder="Example: The capital of France is [Paris]."
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeGapfillNumberedItem(block.id, itemIndex)}
                                        disabled={(gapfillData?.numbered_items || []).length <= 1}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Detected blanks preview
                            </p>
                            {gapfillTemplates.some((template) => parseGapfillTemplate(template).blankCount > 0) ? (
                              <div className="space-y-3">
                                {gapfillTemplates.map((template, templateIndex) => {
                                  const parsed = parseGapfillTemplate(template);
                                  if (!parsed.blankCount) return null;
                                  return (
                                    <div key={`gapfill-preview-${block.id}-${templateIndex}`} className="space-y-2">
                                      <p className="text-xs text-muted-foreground">
                                        {gapfillData?.mode === GAPFILL_MODE_NUMBERED ? `Sentence ${templateIndex + 1}` : "Paragraph"}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-1 text-sm">
                                        {parsed.parts.map((part, partIndex) =>
                                          part.kind === "text" ? (
                                            <span key={`text-${partIndex}`} className="whitespace-pre-wrap">
                                              {part.text}
                                            </span>
                                          ) : (
                                            <span
                                              key={`blank-${partIndex}`}
                                              className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700"
                                            >
                                              [{part.type === "choice" ? (part.correctAnswer || part.options.join(" / ")) : part.correctAnswer}]
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Use brackets <span className="font-medium">[ ]</span> for blanks.
                                For choices use <span className="font-medium">/</span> and mark the correct one with
                                <span className="font-medium"> *</span>. Example: <span className="font-medium">[*fish / cat / dog]</span>.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : null}

                      {blockType === "find_mistake" ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Instruction (optional)</Label>
                            <Input
                              value={findMistakeData?.prompt || ""}
                              onChange={(event) =>
                                updateFindMistakeBlock(block.id, {
                                  ...(findMistakeData || {}),
                                  prompt: event.target.value,
                                })}
                              placeholder="Example: Click the wrong word in each sentence."
                            />
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <Label>Numbered Sentences</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addFindMistakeSentence(block.id)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add sentence
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {(Array.isArray(findMistakeData?.numbered_items) ? findMistakeData.numbered_items : []).map((item, itemIndex) => (
                                <div key={`find-mistake-item-${block.id}-${itemIndex}`} className="rounded-md border p-2">
                                  <div className="flex items-start gap-2">
                                    <span className="pt-2 text-xs font-medium text-muted-foreground">{itemIndex + 1}.</span>
                                    <Textarea
                                      value={item || ""}
                                      onChange={(event) =>
                                        updateFindMistakeSentenceText(block.id, itemIndex, event.target.value)}
                                      placeholder="Example: She [*go] to the [school] [yesterday]."
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeFindMistakeSentence(block.id, itemIndex)}
                                      disabled={(findMistakeData?.numbered_items || []).length <= 1}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Detected options preview
                            </p>
                            {findMistakeTemplates.some((template) => parseGapfillTemplate(template).blankCount > 0) ? (
                              <div className="space-y-3">
                                {findMistakeTemplates.map((template, templateIndex) => {
                                  const parsed = parseGapfillTemplate(template);
                                  if (!parsed.blankCount) return null;
                                  return (
                                    <div key={`find-mistake-preview-${block.id}-${templateIndex}`} className="space-y-2">
                                      <p className="text-xs text-muted-foreground">Sentence {templateIndex + 1}</p>
                                      <div className="flex flex-wrap items-center gap-1 text-sm">
                                        {parsed.parts.map((part, partIndex) => {
                                          if (part.kind === "text") {
                                            return (
                                              <span key={`find-text-${partIndex}`} className="whitespace-pre-wrap">
                                                {part.text}
                                              </span>
                                            );
                                          }
                                          if (part.type === "choice") {
                                            return (
                                              <span
                                                key={`find-blank-${partIndex}`}
                                                className="inline-flex flex-wrap items-center gap-1 rounded-md border px-1.5 py-0.5"
                                              >
                                                {part.options.map((option, optionIndex) => {
                                                  const isCorrect = part.correctIndex === optionIndex;
                                                  return (
                                                    <span
                                                      key={`find-opt-${partIndex}-${optionIndex}`}
                                                      className={`rounded px-1 py-0.5 text-xs font-medium ${
                                                        isCorrect
                                                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                                          : "border border-rose-200 bg-rose-50 text-rose-700"
                                                      }`}
                                                    >
                                                      {option}
                                                    </span>
                                                  );
                                                })}
                                              </span>
                                            );
                                          }
                                          const isMarkedCorrect = String(part.raw || "").trim().startsWith("*");
                                          return (
                                            <span
                                              key={`find-plain-${partIndex}`}
                                              className={`rounded-md border px-1.5 py-0.5 text-xs font-medium ${
                                                isMarkedCorrect
                                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                  : "border-rose-200 bg-rose-50 text-rose-700"
                                              }`}
                                            >
                                              {part.correctAnswer}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Use one token per bracket. Mark the mistake with <span className="font-medium">*</span>.
                                Example: <span className="font-medium">She [*go] to the [school] [yesterday].</span>
                              </p>
                            )}
                          </div>
                        </div>
                      ) : null}

                      {blockType === "internal" ? (
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
                                <SelectItem value="test">Test</SelectItem>
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
                  );
                })}
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
                  <DatePicker
                    value={lesson.due_date}
                    onChange={(value) => updateLesson({ due_date: value })}
                    placeholder="Select due date"
                    buttonClassName="w-full justify-start"
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

