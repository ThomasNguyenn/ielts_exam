import mongoose from "mongoose";

const studyTaskSchema = new mongoose.Schema({
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudyPlan',
        required: true,
    },
    userId: { // Denormalized for easier querying
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    type: {
        type: String,
        enum: ['reading_passage', 'vocabulary_set', 'listening_section', 'writing_task', 'speaking_topic'],
        required: true,
    },
    referenceId: {
        type: String, // IDs are strings (e.g., passage-123)
        required: true,
    },
    title: {
        type: String, // Snapshot of title for display without population
        required: true,
    },
    link: {
        type: String, // Custom link to practice page
        required: false,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'skipped'],
        default: 'pending',
    },
    completedAt: {
        type: Date,
    }
});

// Index for efficient querying of daily tasks
studyTaskSchema.index({ userId: 1, date: 1 });

export default mongoose.model('StudyTask', studyTaskSchema);
