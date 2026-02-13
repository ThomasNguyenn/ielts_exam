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
  audioUrl: { type: String }, // Path to the uploaded audio file
  audioMimeType: { type: String },
  transcript: { type: String }, // Transcription from Groq Whisper
  ai_source: { type: String, default: null },
  
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

  metrics: {
    wpm: { type: Number, default: 0 },
    pauses: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  
  status: {
    type: String,
    enum: ['recording', 'processing', 'completed', 'failed'],
    default: 'recording'
  },
  timestamp: { type: Date, default: Date.now }
});

SpeakingSessionSchema.index({ userId: 1, status: 1, timestamp: -1 });
SpeakingSessionSchema.index({ userId: 1, timestamp: -1 });
SpeakingSessionSchema.index({ questionId: 1, timestamp: -1 });
SpeakingSessionSchema.index({ status: 1, timestamp: -1 });
SpeakingSessionSchema.index({ userId: 1, "analysis.band_score": 1 });

const SpeakingSession = mongoose.model('SpeakingSession', SpeakingSessionSchema);
export default SpeakingSession;
