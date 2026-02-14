import mongoose from 'mongoose';

const checkpointQuizSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    options: [{
        type: String,
        required: true
    }],
    correctAnswer: {
        type: Number,
        required: true
    },
    explanation: {
        type: String
    }
}, { _id: false });

const skillModuleSchema = new mongoose.Schema({
    moduleNumber: {
        type: Number,
        required: true,
        min: 1,
        max: 7
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    content: {
        lesson: {
            type: String, // HTML/Markdown content
            required: true
        },
        videoUrl: {
            type: String
        },
        examples: [{
            type: String
        }],
        keyPoints: [{
            type: String
        }],
        checkpointQuiz: [checkpointQuizSchema]
    },
    estimatedMinutes: {
        type: Number,
        default: 10
    },
    unlockRequirement: {
        previousModule: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SkillModule'
        },
        minimumScore: {
            type: Number,
            default: 70
        }
    },
    icon: {
        type: String,
        default: '📚'
    },
    order: {
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for efficient querying
skillModuleSchema.index({ moduleNumber: 1, order: 1 });
skillModuleSchema.index({ isActive: 1 });

const SkillModule = mongoose.model('SkillModule', skillModuleSchema);
export default SkillModule;
