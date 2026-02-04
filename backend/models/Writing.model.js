import mongoose from 'mongoose';

const WritingSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  title: { type: String, required: true }, // e.g., "Cambridge 18 - Writing Test 1"
  type: { type: String, enum: ['academic', 'general'], default: 'academic' }, // Writing type
  prompt: { type: String, required: true }, // The writing prompt/instructions
  
  // Task-specific info
  task_type: { type: String, enum: ['task1', 'task2', 'both'], default: 'both' }, // Task 1 (graphs/charts) or Task 2 (essay)
  image_url: { type: String }, // Image URL for Task 1 (graphs, charts, diagrams)
  word_limit: { type: Number, default: 250 }, // For Task 1
  essay_word_limit: { type: Number, default: 250 }, // For Task 2
  time_limit: { type: Number, default: 60 }, // Time in minutes
  
  // Sample answer (for reference/grading)
  sample_answer: { type: String },
  band_score: { type: Number, min: 0, max: 9 },
  
  // Metadata
  created_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },
});

const Writing = mongoose.model('Writing', WritingSchema);
export default Writing;
