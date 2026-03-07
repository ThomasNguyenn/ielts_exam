import mongoose from "mongoose";

const ASSIGNMENT_STATUSES = ["draft", "published", "archived"];
const TASK_RESOURCE_MODES = ["internal", "external_url", "uploaded"];
const TASK_RESOURCE_REF_TYPES = ["passage", "section", "speaking", "writing", "test", null];
const CONTENT_BLOCK_TYPES = ["instruction", "video", "input", "title", "internal", "passage", "quiz", "matching", "gapfill", "find_mistake", "dictation"];

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isValidQuizQuestion = (question) => {
  if (!isPlainObject(question)) return false;
  if (question.options !== undefined && !Array.isArray(question.options)) return false;
  return true;
};

const isValidQuizBlockData = (data) => {
  if (!isPlainObject(data)) return false;
  if (data.questions !== undefined) {
    if (!Array.isArray(data.questions)) return false;
    return data.questions.every((question) => isValidQuizQuestion(question));
  }

  // Backward-compatible legacy shape support: question/options at block root.
  if (data.options !== undefined && !Array.isArray(data.options)) return false;
  return true;
};

const isValidMatchingBlockData = (data) => {
  if (!isPlainObject(data)) return false;
  if (data.left_items !== undefined && !Array.isArray(data.left_items)) return false;
  if (data.right_items !== undefined && !Array.isArray(data.right_items)) return false;
  if (data.matches !== undefined && !Array.isArray(data.matches)) return false;

  if (Array.isArray(data.left_items) && data.left_items.some((item) => !isPlainObject(item))) return false;
  if (Array.isArray(data.right_items) && data.right_items.some((item) => !isPlainObject(item))) return false;
  if (
    Array.isArray(data.matches)
    && data.matches.some(
      (pair) =>
        !isPlainObject(pair)
        || !String(pair.left_id || "").trim()
        || !String(pair.right_id || "").trim(),
    )
  ) {
    return false;
  }

  return true;
};

const isValidGapfillBlockData = (data) => {
  if (!isPlainObject(data)) return false;

  if (data.mode !== undefined) {
    const mode = String(data.mode || "").trim().toLowerCase();
    if (!["numbered", "paragraph"].includes(mode)) return false;
  }

  if (data.numbered_items !== undefined) {
    if (!Array.isArray(data.numbered_items)) return false;
    if (data.numbered_items.some((item) => typeof item !== "string")) return false;
  }

  if (data.paragraph_text !== undefined && typeof data.paragraph_text !== "string") return false;
  if (data.prompt !== undefined && typeof data.prompt !== "string") return false;
  return true;
};

const isValidFindMistakeBlockData = (data) => {
  if (!isPlainObject(data)) return false;

  if (data.numbered_items !== undefined) {
    if (!Array.isArray(data.numbered_items)) return false;
    if (data.numbered_items.some((item) => typeof item !== "string")) return false;
  }

  if (data.prompt !== undefined && typeof data.prompt !== "string") return false;
  return true;
};

const isValidDictationBlockData = (data) => {
  if (!isPlainObject(data)) return false;
  if (data.prompt !== undefined && typeof data.prompt !== "string") return false;
  if (data.audio_url !== undefined && typeof data.audio_url !== "string") return false;
  if (data.audio_storage_key !== undefined && typeof data.audio_storage_key !== "string") return false;
  if (data.transcript !== undefined && typeof data.transcript !== "string") return false;
  return true;
};

const AssignmentContentBlockSchema = new mongoose.Schema(
  {
    type: { type: String, enum: CONTENT_BLOCK_TYPES, required: true, trim: true },
    order: { type: Number, default: 0, min: 0 },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator(value) {
          if (!isPlainObject(value)) return false;
          if (String(this?.type || "") === "quiz") return isValidQuizBlockData(value);
          if (String(this?.type || "") === "matching") return isValidMatchingBlockData(value);
          if (String(this?.type || "") === "gapfill") return isValidGapfillBlockData(value);
          if (String(this?.type || "") === "find_mistake") return isValidFindMistakeBlockData(value);
          if (String(this?.type || "") === "dictation") return isValidDictationBlockData(value);
          return true;
        },
        message: "Invalid block data",
      },
    },
  },
  { _id: false },
);

const AssignmentLessonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    instruction: { type: String, default: "", trim: true },
    order: { type: Number, default: 0, min: 0 },
    is_published: { type: Boolean, default: false },
    resource_mode: {
      type: String,
      enum: TASK_RESOURCE_MODES,
      default: "internal",
    },
    resource_ref_type: {
      type: String,
      enum: TASK_RESOURCE_REF_TYPES,
      default: null,
    },
    resource_ref_id: { type: String, default: null, trim: true },
    resource_url: { type: String, default: null, trim: true },
    resource_storage_key: { type: String, default: null, trim: true },
    requires_text: { type: Boolean, default: false },
    requires_image: { type: Boolean, default: false },
    requires_audio: { type: Boolean, default: false },
    min_words: { type: Number, min: 0, default: null },
    max_words: { type: Number, min: 0, default: null },
    due_date: { type: Date, default: null },
    content_blocks: [AssignmentContentBlockSchema],
  },
  { _id: true },
);

const AssignmentSectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0, min: 0 },
    is_published: { type: Boolean, default: false },
    lessons: [AssignmentLessonSchema],
  },
  { _id: true },
);

const AssignmentTaskSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    instruction: { type: String, default: "", trim: true },
    order: { type: Number, default: 0, min: 0 },
    resource_mode: {
      type: String,
      enum: TASK_RESOURCE_MODES,
      default: "internal",
    },
    resource_ref_type: {
      type: String,
      enum: TASK_RESOURCE_REF_TYPES,
      default: null,
    },
    resource_ref_id: { type: String, default: null, trim: true },
    resource_url: { type: String, default: null, trim: true },
    resource_storage_key: { type: String, default: null, trim: true },
    requires_text: { type: Boolean, default: false },
    requires_image: { type: Boolean, default: false },
    requires_audio: { type: Boolean, default: false },
    min_words: { type: Number, min: 0, default: null },
    max_words: { type: Number, min: 0, default: null },
    due_date: { type: Date, default: null },
    content_blocks: [AssignmentContentBlockSchema],
  },
  { _id: true },
);

const MonthlyAssignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    month: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    week: { type: Number, required: true, min: 1, max: 5 },
    due_date: { type: Date, required: true },
    status: {
      type: String,
      enum: ASSIGNMENT_STATUSES,
      default: "draft",
    },
    target_group_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "HomeworkGroup",
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    co_teachers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    sections: [AssignmentSectionSchema],
    tasks: [AssignmentTaskSchema],
  },
  { timestamps: true },
);

MonthlyAssignmentSchema.index({ month: 1, week: 1, status: 1, due_date: 1 });
MonthlyAssignmentSchema.index({ created_by: 1, status: 1, createdAt: -1 });
MonthlyAssignmentSchema.index({ target_group_ids: 1, status: 1, due_date: 1 });
MonthlyAssignmentSchema.index({ co_teachers: 1 });

const MonthlyAssignment =
  mongoose.models.MonthlyAssignment ||
  mongoose.model("MonthlyAssignment", MonthlyAssignmentSchema);

export { ASSIGNMENT_STATUSES, TASK_RESOURCE_MODES, TASK_RESOURCE_REF_TYPES, CONTENT_BLOCK_TYPES };
export default MonthlyAssignment;
