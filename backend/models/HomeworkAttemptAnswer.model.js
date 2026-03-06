import mongoose from "mongoose";

const HomeworkAttemptAnswerSchema = new mongoose.Schema(
  {
    attempt_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomeworkAttempt",
      required: true,
    },
    student_assignment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomeworkStudentAssignment",
      required: true,
    },
    question_key: {
      type: String,
      required: true,
      trim: true,
    },
    answer_value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    normalized_answer: {
      type: String,
      default: null,
      trim: true,
    },
    save_seq: {
      type: Number,
      default: 0,
      min: 0,
    },
    answered_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

HomeworkAttemptAnswerSchema.index({ attempt_id: 1, question_key: 1 }, { unique: true });
HomeworkAttemptAnswerSchema.index({ attempt_id: 1, updated_at: -1 });

const HomeworkAttemptAnswer =
  mongoose.models.HomeworkAttemptAnswer
  || mongoose.model("HomeworkAttemptAnswer", HomeworkAttemptAnswerSchema);

export default HomeworkAttemptAnswer;
