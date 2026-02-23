import mongoose from 'mongoose';

const WritingSubmissionSchema = new mongoose.Schema({
  test_id: { type: String, ref: 'Test' }, // Optional if standalone practice
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Linked user
  attempt_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TestAttempt' }, // Linked attempt for history
  student_name: { type: String }, // Optional: for tracking student
  student_email: { type: String }, // Optional: for tracking student

  // Writing answers array - one entry per writing task
  writing_answers: [{
    task_id: { type: String, required: true, ref: 'Writing' },
    task_title: { type: String },
    answer_text: { type: String, required: true },
    word_count: { type: Number },
  }],

  // Scoring information (filled by teacher later)
  scores: [{
    task_id: { type: String, ref: 'Writing' },
    score: { type: Number, min: 0, max: 9 }, // IELTS band score
    feedback: { type: String },
    scored_by: { type: String }, // Teacher name/ID
    scored_at: { type: Date },
  }],
  score: { type: Number }, // Overall band score

  // AI Grading results (stored as the full JSON from OpenAI)
  ai_result: { type: mongoose.Schema.Types.Mixed },
  is_ai_graded: { type: Boolean, default: false },

  // Metadata
  submitted_at: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'processing', 'scored', 'reviewed', 'failed'],
    default: 'pending'
  },

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

WritingSubmissionSchema.index({ status: 1, submitted_at: -1 });
WritingSubmissionSchema.index({ user_id: 1, submitted_at: -1 });
WritingSubmissionSchema.index({ user_id: 1, status: 1, submitted_at: -1 });
WritingSubmissionSchema.index({ attempt_id: 1 });
WritingSubmissionSchema.index({ submitted_at: -1 });

const WritingSubmission = mongoose.model('WritingSubmission', WritingSubmissionSchema);
export default WritingSubmission;
