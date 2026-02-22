import mongoose from "mongoose";

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
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student',
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
  activeSessionId: {
    type: String,
    default: null,
  },
  activeSessionIssuedAt: {
    type: Date,
    default: null,
  },
  verificationToken: { type: String, default: null },
  verificationTokenExpires: { type: Date, default: null },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
});

userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ role: 1, isConfirmed: 1, createdAt: -1 });

export default mongoose.model('User', userSchema);
