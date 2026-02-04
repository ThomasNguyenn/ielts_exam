import mongoose from 'mongoose';

const TestAttemptSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  test_id: { type: String, required: true, ref: 'Test' },
  type: { type: String, enum: ['reading', 'listening', 'writing'], required: true },
  score: { type: Number, default: null },
  total: { type: Number, default: null },
  wrong: { type: Number, default: null },
  skipped: { type: Number, default: 0 },
  percentage: { type: Number, default: null },
  time_taken_ms: { type: Number, default: null },
  submitted_at: { type: Date, default: Date.now },
}, { timestamps: true });

TestAttemptSchema.index({ user_id: 1, test_id: 1, submitted_at: -1 });

const TestAttempt = mongoose.model('TestAttempt', TestAttemptSchema);
export default TestAttempt;
