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

  // Extra details for writing attempts
  writing_details: {
    task1_score: Number,
    task2_score: Number,
    feedback: String
  },

  // Store the exact text the student highlighted during the exam
  student_highlights: [{ type: String }],

  // Detailed question analysis for Weakness Detective
  detailed_answers: [{
    question_number: Number,
    question_type: String, // e.g., 'multiple_choice', 'true_false_not_given'
    is_correct: Boolean,
    user_answer: String,
    correct_answer: String
  }],

  // Error Taxonomy Tracking
  error_logs: [{
    task_type: { type: String }, // 'matching_headings', 'task1', 'part2', etc.
    cognitive_skill: { type: String }, // e.g., 'R1. Literal Comprehension'
    error_category: { type: String },  // e.g., 'A. Answer-Level Errors'
    error_code: { type: String, required: true }, // e.g., 'R-A1', 'W2-G1', 'S-F1'
    question_number: { type: Number }, // For R/L
    user_answer: { type: String },     // Raw answer for R/L
    correct_answer: { type: String },  // Target answer for R/L
    student_highlights: [{ type: String }], // What text they highlighted before answering
    text_snippet: { type: String },    // Exact phrase containing the error (for W/S)
    explanation: { type: String },     // AI explanation of why it's an error
    meta_error: { type: String }       // e.g., 'X1 Careless Error', 'X2 Time Pressure'
  }]
}, { timestamps: true });

TestAttemptSchema.index({ user_id: 1, test_id: 1, submitted_at: -1 });
TestAttemptSchema.index({ user_id: 1, type: 1, submitted_at: -1 });
TestAttemptSchema.index({ submitted_at: -1 });

const TestAttempt = mongoose.model('TestAttempt', TestAttemptSchema);
export default TestAttempt;
