import mongoose from "mongoose";

const AnalyticsSnapshotSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    version: { type: Number, default: 1 },
    attempts_entries: { type: mongoose.Schema.Types.Mixed, default: {} },
    writing_entries: { type: mongoose.Schema.Types.Mixed, default: {} },
    speaking_entries: { type: mongoose.Schema.Types.Mixed, default: {} },
    watermarks: {
      attempts_updated_at: { type: Date, default: null },
      writings_updated_at: { type: Date, default: null },
      speakings_updated_at: { type: Date, default: null },
    },
    refreshed_at: { type: Date, default: null },
  },
  { timestamps: true },
);

const AnalyticsSnapshot =
  mongoose.models.AnalyticsSnapshot ||
  mongoose.model("AnalyticsSnapshot", AnalyticsSnapshotSchema);

export default AnalyticsSnapshot;
