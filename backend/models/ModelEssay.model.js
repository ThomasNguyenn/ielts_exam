import mongoose from 'mongoose';

const annotationSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: [
            'thesis',
            'topic_sentence',
            'linking_phrase',
            'advanced_vocab',
            'grammar_structure',
            'example',
            'conclusion',
            'cohesive_device'
        ],
        required: true
    },
    explanation: {
        type: String,
        required: true
    },
    position: {
        start: {
            type: Number,
            required: true
        },
        end: {
            type: Number,
            required: true
        }
    },
    highlightColor: {
        type: String,
        default: '#fef08a' // yellow
    }
}, { _id: false });

const modelEssaySchema = new mongoose.Schema({
    questionType: {
        type: String,
        enum: [
            'opinion',
            'discussion',
            'advantage_disadvantage',
            'problem_solution',
            'two_part',
            'direct_question'
        ],
        required: true
    },
    topic: {
        type: String,
        required: true
    },
    prompt: {
        type: String,
        required: true
    },
    taskType: {
        type: String,
        enum: ['task1', 'task2'],
        default: 'task2'
    },
    bandScore: {
        type: Number,
        required: true,
        min: 7.0,
        max: 9.0
    },
    essay: {
        type: String,
        required: true
    },
    wordCount: {
        type: Number,
        required: true
    },

    // Rich annotations
    annotations: [annotationSchema],

    // Analysis breakdown
    analysis: {
        strengths: [{
            type: String
        }],
        techniques: [{
            type: String
        }],
        vocabularyLevel: {
            type: String,
            enum: ['band7', 'band8', 'band9'],
            default: 'band8'
        },
        grammarComplexity: {
            type: String,
            enum: ['high', 'very_high'],
            default: 'high'
        }
    },

    // Comparison essay (for Band 5 vs Band 8 feature)
    comparisonEssay: {
        lowerBandScore: {
            type: Number,
            min: 5.0,
            max: 6.5
        },
        lowerBandEssay: {
            type: String
        },
        differences: [{
            aspect: String,
            lowerBandIssue: String,
            higherBandSolution: String
        }]
    },

    // Metadata
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'intermediate'
    },
    tags: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes
modelEssaySchema.index({ questionType: 1, taskType: 1 });
modelEssaySchema.index({ bandScore: -1 });
modelEssaySchema.index({ difficulty: 1 });
modelEssaySchema.index({ isActive: 1 });
modelEssaySchema.index({ tags: 1 });

const ModelEssay = mongoose.models.ModelEssay || mongoose.model('ModelEssay', modelEssaySchema);
export default ModelEssay;

