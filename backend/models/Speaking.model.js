import mongoose from 'mongoose';

const SpeakingSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  title: { type: String, required: true }, // e.g., "Hometown & Background"
  part: { type: Number, enum: [1, 2, 3], required: true }, // IELTS Speaking Part
  prompt: { type: String, required: true }, // The main question or card text
  sub_questions: [{ type: String }], // Follow-up questions for Part 1 or 3
  
  // Model answer/keywords (for AI reference)
  keywords: [{ type: String }],
  sample_highlights: { type: String },
  
  // Metadata
  created_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },
});

const Speaking = mongoose.model('Speaking', SpeakingSchema);
export default Speaking;
