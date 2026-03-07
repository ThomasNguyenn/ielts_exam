import mongoose from "mongoose";
import {
  ROLE_ADMIN,
  ROLE_STUDENT,
  ROLE_STUDENT_ACA,
  ROLE_STUDENT_IELTS,
  ROLE_TEACHER,
} from "../utils/role.utils.js";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  avatarSeed: {
    type: String,
    default: "",
    trim: true,
    maxlength: 120,
  },
  role: {
    type: String,
    enum: [ROLE_STUDENT, ROLE_STUDENT_IELTS, ROLE_STUDENT_ACA, ROLE_TEACHER, ROLE_ADMIN],
    default: ROLE_STUDENT,
  },
  homeroom_teacher_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  targets: {
    listening: { type: Number, default: 0 },
    reading: { type: Number, default: 0 },
    writing: { type: Number, default: 0 },
    speaking: { type: Number, default: 0 },
  },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isConfirmed: {
    type: Boolean,
    default: false,
  },
  createdByTeacherBulk: {
    type: Boolean,
    default: false,
  },
  mustCompleteFirstLogin: {
    type: Boolean,
    default: false,
  },
  firstLoginCompletedAt: {
    type: Date,
    default: null,
  },
  activeSessionId: {
    type: String,
    default: null,
  },
  activeSessionIssuedAt: {
    type: Date,
    default: null,
  },
  lastSeenAt: {
    type: Date,
    default: null,
  },
  verificationToken: { type: String, default: null },
  verificationTokenExpires: { type: Date, default: null },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  pendingEmail: { type: String, default: null, lowercase: true, trim: true },
  emailChangeTokenHash: { type: String, default: null },
  emailChangeTokenExpires: { type: Date, default: null },
  refreshTokenHash: { type: String, default: null },
  refreshTokenExpiresAt: { type: Date, default: null },
  refreshTokenIssuedAt: { type: Date, default: null },

  // Achievement tracking
  achievements: [{
    achievementKey: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now }
  }],
  totalAchievements: { type: Number, default: 0 },
});

userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ role: 1, isConfirmed: 1, createdAt: -1 });
userSchema.index({ role: 1, xp: -1 }); // Leaderboard
userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1, lastSeenAt: -1, createdAt: -1 });
userSchema.index({ role: 1, homeroom_teacher_id: 1, createdAt: -1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
