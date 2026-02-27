import mongoose from "mongoose";

const TASK_TYPES = ['reading_passage', 'vocabulary_set', 'listening_section', 'writing_task', 'speaking_topic'];
const TASK_STATUS = ['pending', 'completed', 'skipped'];

const studyTaskProgressSchema = new mongoose.Schema({
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudyPlan',
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    taskKey: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    type: {
        type: String,
        enum: TASK_TYPES,
        required: true,
    },
    referenceId: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    link: {
        type: String,
        required: false,
    },
    status: {
        type: String,
        enum: TASK_STATUS,
        default: 'pending',
    },
    completedAt: {
        type: Date,
        required: false,
    }
}, { timestamps: true });

studyTaskProgressSchema.index({ userId: 1, planId: 1, taskKey: 1 }, { unique: true });
studyTaskProgressSchema.index({ userId: 1, planId: 1, date: 1 });
studyTaskProgressSchema.index({ userId: 1, status: 1, completedAt: -1 });

const StudyTaskProgress = mongoose.models.StudyTaskProgress || mongoose.model('StudyTaskProgress', studyTaskProgressSchema);
export default StudyTaskProgress;
