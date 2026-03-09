import mongoose from "mongoose";

const HomeworkRewardClaimSchema = new mongoose.Schema(
  {
    assignment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MonthlyAssignment",
      required: true,
    },
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chest_key: {
      type: String,
      required: true,
      trim: true,
    },
    xp_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    claimed_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

HomeworkRewardClaimSchema.index(
  { assignment_id: 1, student_id: 1, chest_key: 1 },
  { unique: true },
);
HomeworkRewardClaimSchema.index({ assignment_id: 1, student_id: 1, claimed_at: -1 });

const HomeworkRewardClaim =
  mongoose.models.HomeworkRewardClaim
  || mongoose.model("HomeworkRewardClaim", HomeworkRewardClaimSchema);

export default HomeworkRewardClaim;
