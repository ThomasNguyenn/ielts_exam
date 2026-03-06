import mongoose from "mongoose";

const HOMEWORK_STUDENT_ASSIGNMENT_STATUSES = [
  "assigned",
  "opened",
  "started",
  "in_progress",
  "submitted",
  "abandoned",
];

const HomeworkStudentAssignmentSchema = new mongoose.Schema(
  {
    assignment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MonthlyAssignment",
      required: true,
    },
    task_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: HOMEWORK_STUDENT_ASSIGNMENT_STATUSES,
      default: "assigned",
    },
    assigned_at: { type: Date, default: Date.now },
    opened_at: { type: Date, default: null },
    started_at: { type: Date, default: null },
    first_interaction_at: { type: Date, default: null },
    last_activity_at: { type: Date, default: null },
    submitted_at: { type: Date, default: null },
    abandoned_at: { type: Date, default: null },
    current_attempt_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomeworkAttempt",
      default: null,
    },
    open_count: { type: Number, default: 0, min: 0 },
    resume_count: { type: Number, default: 0, min: 0 },
    tab_switch_count: { type: Number, default: 0, min: 0 },
    refresh_count: { type: Number, default: 0, min: 0 },
    version: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true },
);

HomeworkStudentAssignmentSchema.index(
  { assignment_id: 1, task_id: 1, student_id: 1 },
  { unique: true },
);
HomeworkStudentAssignmentSchema.index({ student_id: 1, status: 1, updatedAt: -1 });
HomeworkStudentAssignmentSchema.index({ assignment_id: 1, task_id: 1, status: 1 });

const HomeworkStudentAssignment =
  mongoose.models.HomeworkStudentAssignment
  || mongoose.model("HomeworkStudentAssignment", HomeworkStudentAssignmentSchema);

export { HOMEWORK_STUDENT_ASSIGNMENT_STATUSES };
export default HomeworkStudentAssignment;
