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

  // Metadata
  submitted_at: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'scored', 'reviewed'],
    default: 'pending'
  },
}, { timestamps: true });

const WritingSubmission = mongoose.model('WritingSubmission', WritingSubmissionSchema);
export default WritingSubmission;
