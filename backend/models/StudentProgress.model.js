import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    earnedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const studentProgressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },

    // Skill-specific scores (0-100)
    skillScores: {
        taskUnderstanding: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        thesisCrafting: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        paragraphStructure: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        coherence: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        vocabulary: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        grammar: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        ideaDevelopment: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    },

    // Module completion tracking
    completedModules: [{
        moduleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SkillModule'
        },
        completedAt: {
            type: Date,
            default: Date.now
        },
        quizScore: {
            type: Number
        }
    }],

    // Achievement system
    badges: [badgeSchema],

    // Difficulty level
    currentLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'beginner'
    },

    // Overall statistics
    totalEssays: {
        type: Number,
        default: 0
    },
    averageBandScore: {
        type: Number,
        default: 0
    },
    improvementRate: {
        type: Number,
        default: 0
    },

    // Learning path
    learningPath: {
        type: String,
        enum: ['foundation', 'exam_ready', 'mastery', 'custom'],
        default: 'foundation'
    },

    // Engagement tracking
    lastPracticeDate: {
        type: Date
    },
    streak: {
        type: Number,
        default: 0
    },
    longestStreak: {
        type: Number,
        default: 0
    },

    // Weekly target
    weeklyGoal: {
        essaysTarget: {
            type: Number,
            default: 3
        },
        modulesTarget: {
            type: Number,
            default: 2
        }
    }
}, {
    timestamps: true
});

// Indexes
studentProgressSchema.index({ currentLevel: 1 });
studentProgressSchema.index({ lastPracticeDate: -1 });

// Methods
studentProgressSchema.methods.updateStreak = function () {
    const now = new Date();
    const lastPractice = this.lastPracticeDate;

    if (!lastPractice) {
        this.streak = 1;
    } else {
        const daysDiff = Math.floor((now - lastPractice) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
            // Consecutive day
            this.streak += 1;
        } else if (daysDiff > 1) {
            // Streak broken
            this.streak = 1;
        }
        // If same day, streak stays the same
    }

    if (this.streak > this.longestStreak) {
        this.longestStreak = this.streak;
    }

    this.lastPracticeDate = now;
};

studentProgressSchema.methods.awardBadge = function (name, icon, description) {
    const existingBadge = this.badges.find(b => b.name === name);
    if (!existingBadge) {
        this.badges.push({ name, icon, description });
        return true;
    }
    return false;
};

const StudentProgress = mongoose.model('StudentProgress', studentProgressSchema);
export default StudentProgress;
