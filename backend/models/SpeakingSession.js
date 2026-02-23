import mongoose from 'mongoose';

const SpeakingSessionSchema = new mongoose.Schema({
  questionId: {
    type: String,
    ref: 'Speaking',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },

  // Audio & Transcript
  audioUrl: { type: String }, // Cloud URL (or local path for legacy records)
  audioPublicId: { type: String, default: null },
  audioDeletedAt: { type: Date, default: null },
  audioMimeType: { type: String },
  transcript: { type: String }, // Transcription from Groq Whisper
  ai_source: { type: String, default: null },
  scoring_state: {
    type: String,
    enum: ["processing", "provisional_ready", "completed", "failed"],
    default: "processing",
  },
  provisional_source: { type: String, default: null },
  provisional_ready_at: { type: Date, default: null },

  // AI Analysis (Groq Llama 3)
  analysis: {
    band_score: { type: Number },
    fluency_coherence: {
      score: Number,
      feedback: String
    },
    lexical_resource: {
      score: Number,
      feedback: String
    },
    grammatical_range: {
      score: Number,
      feedback: String
    },
    pronunciation: {
      score: Number,
      feedback: String
    },
    general_feedback: { type: String },
    sample_answer: { type: String }
  },
  provisional_analysis: {
    band_score: { type: Number },
    fluency_coherence: {
      score: Number,
      feedback: String
    },
    lexical_resource: {
      score: Number,
      feedback: String
    },
    grammatical_range: {
      score: Number,
      feedback: String
    },
    pronunciation: {
      score: Number,
      feedback: String
    },
    general_feedback: { type: String },
    sample_answer: { type: String }
  },

  metrics: {
    wpm: { type: Number, default: 0 },
    pauses: { type: mongoose.Schema.Types.Mixed, default: {} },
  },

  mockExaminerTurns: [
    {
      role: {
        type: String,
        enum: ['examiner', 'candidate'],
        required: true,
      },
      message: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  mockExaminerMeta: {
    ai_source: { type: String, default: null },
    lastFeedback: { type: String, default: '' },
    finalAssessment: { type: String, default: '' },
    isCompleted: { type: Boolean, default: false },
    updatedAt: { type: Date, default: null },
  },

  status: {
    type: String,
    enum: ['recording', 'processing', 'completed', 'failed'],
    default: 'recording'
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
  }],

  timestamp: { type: Date, default: Date.now }
});

SpeakingSessionSchema.index({ userId: 1, status: 1, timestamp: -1 });
SpeakingSessionSchema.index({ userId: 1, scoring_state: 1, timestamp: -1 });
SpeakingSessionSchema.index({ userId: 1, timestamp: -1 });
SpeakingSessionSchema.index({ questionId: 1, timestamp: -1 });
SpeakingSessionSchema.index({ status: 1, timestamp: -1 });
SpeakingSessionSchema.index({ userId: 1, "analysis.band_score": 1 });

const SpeakingSession = mongoose.model('SpeakingSession', SpeakingSessionSchema);
export default SpeakingSession;
