import mongoose from "mongoose";

const HOMEWORK_ATTEMPT_STATUSES = ["started", "in_progress", "submitted", "abandoned"];
const HOMEWORK_ATTEMPT_ORIGIN_SURFACES = ["homework_launch", "tests_direct"];
const HOMEWORK_ATTEMPT_RESOURCE_REF_TYPES = ["test", "passage", "section", "speaking", "writing"];

const HomeworkAttemptSchema = new mongoose.Schema(
  {
    student_assignment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomeworkStudentAssignment",
      required: true,
    },
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
    attempt_no: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: HOMEWORK_ATTEMPT_STATUSES,
      default: "started",
    },
    started_at: { type: Date, default: Date.now },
    first_interaction_at: { type: Date, default: null },
    last_activity_at: { type: Date, default: Date.now },
    submitted_at: { type: Date, default: null },
    abandoned_at: { type: Date, default: null },
    active_tab_session_id: { type: String, default: null, trim: true },
    lease_expires_at: { type: Date, default: null },
    resume_count: { type: Number, default: 0, min: 0 },
    heartbeat_count: { type: Number, default: 0, min: 0 },
    origin_surface: {
      type: String,
      enum: HOMEWORK_ATTEMPT_ORIGIN_SURFACES,
      default: "tests_direct",
    },
    resource_ref_type: {
      type: String,
      enum: HOMEWORK_ATTEMPT_RESOURCE_REF_TYPES,
      default: "test",
    },
    resource_ref_id: { type: String, default: "", trim: true },
    linked_test_attempt_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestAttempt",
      default: null,
    },
  },
  { timestamps: true },
);

HomeworkAttemptSchema.index({ student_assignment_id: 1, status: 1, createdAt: -1 });
HomeworkAttemptSchema.index({ student_id: 1, assignment_id: 1, task_id: 1, createdAt: -1 });
HomeworkAttemptSchema.index({ status: 1, last_activity_at: 1 });

const HomeworkAttempt =
  mongoose.models.HomeworkAttempt || mongoose.model("HomeworkAttempt", HomeworkAttemptSchema);

export {
  HOMEWORK_ATTEMPT_STATUSES,
  HOMEWORK_ATTEMPT_ORIGIN_SURFACES,
  HOMEWORK_ATTEMPT_RESOURCE_REF_TYPES,
};
export default HomeworkAttempt;
