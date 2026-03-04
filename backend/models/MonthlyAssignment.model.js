import mongoose from "mongoose";

const ASSIGNMENT_STATUSES = ["draft", "published", "archived"];
const TASK_RESOURCE_MODES = ["internal", "external_url", "uploaded"];
const TASK_RESOURCE_REF_TYPES = ["passage", "section", "speaking", "writing", null];

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
    tasks: [AssignmentTaskSchema],
  },
  { timestamps: true },
);

MonthlyAssignmentSchema.index({ month: 1, week: 1, status: 1, due_date: 1 });
MonthlyAssignmentSchema.index({ created_by: 1, status: 1, createdAt: -1 });
MonthlyAssignmentSchema.index({ target_group_ids: 1, status: 1, due_date: 1 });

const MonthlyAssignment =
  mongoose.models.MonthlyAssignment ||
  mongoose.model("MonthlyAssignment", MonthlyAssignmentSchema);

export { ASSIGNMENT_STATUSES, TASK_RESOURCE_MODES, TASK_RESOURCE_REF_TYPES };
export default MonthlyAssignment;
