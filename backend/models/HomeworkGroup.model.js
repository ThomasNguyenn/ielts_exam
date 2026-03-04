import mongoose from "mongoose";

const HomeworkGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    level_label: { type: String, default: "", trim: true },
    student_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
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
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

HomeworkGroupSchema.index({ created_by: 1, is_active: 1, createdAt: -1 });
HomeworkGroupSchema.index({ student_ids: 1 });

const HomeworkGroup =
  mongoose.models.HomeworkGroup ||
  mongoose.model("HomeworkGroup", HomeworkGroupSchema);

export default HomeworkGroup;
