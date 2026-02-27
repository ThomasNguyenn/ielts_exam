import mongoose from "mongoose";

const TASK_TYPES = ['reading_passage', 'vocabulary_set', 'listening_section', 'writing_task', 'speaking_topic'];
const TASK_STATUS = ['completed', 'skipped'];

const studyTaskHistorySchema = new mongoose.Schema({
    sourcePlanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudyPlan',
        required: false,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    taskKey: {
        type: String,
        required: false,
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
        default: 'completed',
    },
    completedAt: {
        type: Date,
        required: false,
    },
    archivedAt: {
        type: Date,
        default: Date.now,
    },
    archivedReason: {
        type: String,
        required: false,
    }
}, { timestamps: true });

studyTaskHistorySchema.index({ userId: 1, completedAt: -1 });
studyTaskHistorySchema.index({ userId: 1, sourcePlanId: 1 });
studyTaskHistorySchema.index({ userId: 1, taskKey: 1 });

const StudyTaskHistory = mongoose.models.StudyTaskHistory || mongoose.model('StudyTaskHistory', studyTaskHistorySchema);
export default StudyTaskHistory;
