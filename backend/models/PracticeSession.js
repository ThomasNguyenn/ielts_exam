import mongoose from 'mongoose';

const PracticeSessionSchema = new mongoose.Schema({
    questionId: {
        type: String,
        ref: 'Writing',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Optional for now if no auth enforcement
    },

    // Phase 1: Ideation
    outline: {
        mainIdeas: [{ type: String }],
        developmentMethod: { type: String },
        topicSentences: [{ type: String }]
    },
    aiFeedback: {
        general_feedback: { type: String },
        improvements: [{ type: String }],
        coherence_score: { type: Number }
    },

    // Phase 2: Scaffolding
    materials: {
        vocab: [{
            word: String,
            meaning: String,
            collocation: String
        }],
        structures: [{
            structure: String,
            example: String
        }],
        translations: [{
            vietnamese: String,
            english_ref: String,
            user_translation: String
        }]
    },

    // Phase 3: Writing
    fullEssay: { type: String },
    gradingResult: {
        band_score: { type: Number },
        criteria_scores: {
            task_response: Number,
            coherence_cohesion: Number,
            lexical_resource: Number,
            grammatical_range_accuracy: Number
        },
        corrected_essay: { type: String },
        feedback: [{ type: String }]
    },

    status: {
        type: String,
        enum: ['ideation', 'scaffolding', 'drafting', 'completed'],
        default: 'ideation'
    },
    timestamp: { type: Date, default: Date.now }
});

const PracticeSession = mongoose.model('PracticeSession', PracticeSessionSchema);
export default PracticeSession;
