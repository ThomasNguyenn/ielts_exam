import mongoose from 'mongoose';

const VocabularySchema = new mongoose.Schema({
    user_id: {
        type: String,
        ref: 'User',
        required: true,
        index: true
    },
    word: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    context: {
        type: String,
        required: true
    }, // The sentence where they found it
    source_test_id: {
        type: String,
        ref: 'Test',
        required: false
    },
    source_passage_id: {
        type: String,
        ref: 'Passage',
        required: false
    },
    definition: {
        type: String,
        required: false
    }, // Optional, can be added later by user
    notes: {
        type: String,
        required: false
    }, // User's personal notes

    // Spaced Repetition System (SRS) fields
    review_count: {
        type: Number,
        default: 0
    },
    next_review_date: {
        type: Date,
        default: Date.now
    },
    mastery_level: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    }, // 0 = new, 5 = mastered

    // Timestamps
    added_at: {
        type: Date,
        default: Date.now
    },
    last_reviewed_at: {
        type: Date,
        required: false
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
VocabularySchema.index({ user_id: 1, word: 1 }, { unique: true });
VocabularySchema.index({ user_id: 1, next_review_date: 1 });

// Method to calculate next review date based on SRS algorithm
VocabularySchema.methods.calculateNextReview = function (difficulty) {
    // difficulty: 'easy' (3), 'medium' (2), 'hard' (1)
    const difficultyMap = { easy: 3, medium: 2, hard: 1 };
    const multiplier = difficultyMap[difficulty] || 2;

    // Update mastery level
    if (difficulty === 'easy') {
        this.mastery_level = Math.min(5, this.mastery_level + 1);
    } else if (difficulty === 'hard') {
        this.mastery_level = Math.max(0, this.mastery_level - 1);
    }

    // Calculate days until next review: 2^mastery_level * multiplier
    const daysUntilReview = Math.pow(2, this.mastery_level) * multiplier;

    this.next_review_date = new Date(Date.now() + daysUntilReview * 24 * 60 * 60 * 1000);
    this.review_count += 1;
    this.last_reviewed_at = new Date();
};

const Vocabulary = mongoose.models.Vocabulary || mongoose.model('Vocabulary', VocabularySchema);
export default Vocabulary;

