import mongoose from "mongoose";

const HOMEWORK_ATTEMPT_EVENT_TYPES = [
  "opened",
  "started",
  "answer_saved",
  "heartbeat",
  "tab_hidden",
  "tab_visible",
  "refresh",
  "resume",
  "submitted",
  "abandoned_auto",
];

const HomeworkAttemptEventSchema = new mongoose.Schema(
  {
    student_assignment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomeworkStudentAssignment",
      required: true,
    },
    attempt_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomeworkAttempt",
      default: null,
    },
    event_id: {
      type: String,
      required: true,
      trim: true,
    },
    event_type: {
      type: String,
      enum: HOMEWORK_ATTEMPT_EVENT_TYPES,
      required: true,
    },
    tab_session_id: { type: String, default: null, trim: true },
    device_id: { type: String, default: null, trim: true },
    client_ts: { type: Date, default: null },
    server_ts: { type: Date, default: Date.now },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

HomeworkAttemptEventSchema.index({ student_assignment_id: 1, event_id: 1 }, { unique: true });
HomeworkAttemptEventSchema.index({ student_assignment_id: 1, server_ts: -1 });
HomeworkAttemptEventSchema.index({ event_type: 1, server_ts: -1 });

const HomeworkAttemptEvent =
  mongoose.models.HomeworkAttemptEvent || mongoose.model("HomeworkAttemptEvent", HomeworkAttemptEventSchema);

export { HOMEWORK_ATTEMPT_EVENT_TYPES };
export default HomeworkAttemptEvent;
