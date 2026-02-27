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

    // Current phase (1-7)
    currentPhase: {
        type: Number,
        min: 1,
        max: 7,
        default: 1
    },

    // Phase 1: Learn
    phase1Data: {
        completedModules: [{
            moduleId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'SkillModule'
            },
            completedAt: Date,
            quizScore: Number
        }],
        timeSpent: Number
    },

    // Phase 2: Understand
    phase2Data: {
        keywords: [String],
        taskType: String,
        comprehensionAnswers: mongoose.Schema.Types.Mixed,
        timeSpent: Number
    },

    // Phase 3: Analyze
    phase3Data: {
        modelEssayId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ModelEssay'
        },
        analysisTasksCompleted: [String],
        timeSpent: Number
    },

    // Phase 4: Plan (Enhanced Ideation)
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

    // Phase 5: Build (Scaffolded Practice)
    phase5Data: {
        paragraphDrafts: [{
            paragraphType: String, // introduction, body1, body2, conclusion
            content: String,
            feedbackScore: Number,
            improvedVersion: String
        }],
        microFeedback: [mongoose.Schema.Types.Mixed],
        timeSpent: Number
    },

    // Phase 6: Write (Scaffolding + Full Essay)
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
    fullEssay: { type: String },
    writingTime: { type: Number }, // milliseconds

    // Phase 7: Review & Grow
    gradingResult: {
        band_score: { type: Number },
        criteria_scores: {
            task_response: Number,
            coherence_cohesion: Number,
            lexical_resource: Number,
            grammatical_range_accuracy: Number
        },
        // Enhanced skill-specific scores
        skill_scores: {
            taskUnderstanding: Number,
            thesisCrafting: Number,
            paragraphStructure: Number,
            coherence: Number,
            vocabulary: Number,
            grammar: Number,
            ideaDevelopment: Number
        },
        corrected_essay: { type: String },
        feedback: [{ type: String }],
        detailedAnalysis: [mongoose.Schema.Types.Mixed]
    },
    phase7Data: {
        reflectionNotes: String,
        growthPlan: [String],
        badgesEarned: [{
            name: String,
            icon: String,
            earnedAt: Date
        }]
    },

    // Learning metadata
    difficultyLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'beginner'
    },
    learningObjectives: [String],
    objectivesMet: [String],

    status: {
        type: String,
        enum: ['phase1', 'phase2', 'phase3', 'phase4', 'phase5', 'phase6', 'phase7', 'completed'],
        default: 'phase1'
    },
    timestamp: { type: Date, default: Date.now },
    completedAt: { type: Date }
});

// Index for efficient querying
PracticeSessionSchema.index({ userId: 1, timestamp: -1 });
PracticeSessionSchema.index({ status: 1 });

const PracticeSession = mongoose.models.PracticeSession || mongoose.model('PracticeSession', PracticeSessionSchema);
export default PracticeSession;


