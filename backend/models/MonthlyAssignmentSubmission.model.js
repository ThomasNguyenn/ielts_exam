import mongoose from "mongoose";

const SubmissionFileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    storage_key: { type: String, required: true, trim: true },
    mime: { type: String, default: "", trim: true },
    size: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const MonthlyAssignmentSubmissionSchema = new mongoose.Schema(
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
    text_answer: { type: String, default: "", trim: true },
    image_items: [SubmissionFileSchema],
    audio_item: { type: SubmissionFileSchema, default: null },
    status: {
      type: String,
      enum: ["submitted", "graded"],
      default: "submitted",
    },
    score: { type: Number, min: 0, max: 10, default: null },
    teacher_feedback: { type: String, default: "", trim: true },
    graded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    graded_at: { type: Date, default: null },
    submitted_at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

MonthlyAssignmentSubmissionSchema.index(
  { assignment_id: 1, task_id: 1, student_id: 1 },
  { unique: true },
);
MonthlyAssignmentSubmissionSchema.index({ assignment_id: 1, task_id: 1, status: 1 });
MonthlyAssignmentSubmissionSchema.index({ student_id: 1, assignment_id: 1, submitted_at: -1 });

const MonthlyAssignmentSubmission =
  mongoose.models.MonthlyAssignmentSubmission ||
  mongoose.model("MonthlyAssignmentSubmission", MonthlyAssignmentSubmissionSchema);

export default MonthlyAssignmentSubmission;
