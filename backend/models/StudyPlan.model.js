import mongoose from "mongoose";

const studyPlanSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    targetDate: {
        type: Date,
        required: true,
    },
    targetBand: {
        type: Number,
        required: true,
        min: 0,
        max: 9,
    },
    currentBand: {
        type: Number,
        default: 0,
    },
    generatedAt: {
        type: Date,
        default: Date.now,
    },
    isActive: {
        type: Boolean,
        default: true,
    }
});

export default mongoose.model('StudyPlan', studyPlanSchema);
