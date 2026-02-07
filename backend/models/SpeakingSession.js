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
  transcript: { type: String }, // Transcription from Groq Whisper
  
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
  
  status: {
    type: String,
    enum: ['recording', 'processing', 'completed'],
    default: 'recording'
  },
  timestamp: { type: Date, default: Date.now }
});

const SpeakingSession = mongoose.model('SpeakingSession', SpeakingSessionSchema);
export default SpeakingSession;
