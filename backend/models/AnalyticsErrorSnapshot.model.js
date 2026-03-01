import mongoose from "mongoose";

const AnalyticsErrorSnapshotSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    version: { type: Number, default: 1 },
    entries: { type: mongoose.Schema.Types.Mixed, default: {} },
    doc_index: {
      attempts: { type: mongoose.Schema.Types.Mixed, default: {} },
      writings: { type: mongoose.Schema.Types.Mixed, default: {} },
      speakings: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    watermarks: {
      attempts_updated_at: { type: Date, default: null },
      writings_updated_at: { type: Date, default: null },
      speakings_updated_at: { type: Date, default: null },
    },
    refreshed_at: { type: Date, default: null },
  },
  { timestamps: true },
);

const AnalyticsErrorSnapshot =
  mongoose.models.AnalyticsErrorSnapshot ||
  mongoose.model("AnalyticsErrorSnapshot", AnalyticsErrorSnapshotSchema);

export default AnalyticsErrorSnapshot;
