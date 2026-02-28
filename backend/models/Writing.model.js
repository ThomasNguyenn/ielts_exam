import mongoose from 'mongoose';
import { WRITING_TASK_TYPE_VALUES } from '../constants/writingTaskTypes.js';

const WritingSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  title: { type: String, required: true }, // e.g., "Cambridge 18 - Writing Test 1"
  type: { type: String, enum: ['academic', 'general'], default: 'academic' }, // Writing type
  prompt: { type: String, required: true }, // The writing prompt/instructions

  // Task-specific info
  task_type: { type: String, enum: ['task1', 'task2'] }, // Task 1 (graphs/charts) or Task 2 (essay)
  writing_task_type: { type: String, enum: WRITING_TASK_TYPE_VALUES, default: null }, // Bar Chart, Line Chart, Agree or Disagree, etc.
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
  is_real_test: { type: Boolean, default: false }, // Distinguish between Practice and "Real" Writing Tests
});

const Writing = mongoose.models.Writing || mongoose.model('Writing', WritingSchema);
export default Writing;

