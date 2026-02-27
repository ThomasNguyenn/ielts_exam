import mongoose from "mongoose";

const achievementSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    category: {
        type: String,
        enum: ['streak', 'test', 'writing', 'speaking', 'module', 'score', 'vocabulary', 'xp', 'speed', 'mastery', 'hidden'],
        required: true
    },
    tier: {
        type: String,
        enum: ['bronze', 'silver', 'gold', 'diamond'],
        default: 'bronze'
    },
    xpReward: { type: Number, default: 100 },
    condition: {
        metric: { type: String, required: true },
        threshold: { type: Number, required: true }
    },
    order: { type: Number, default: 0 }, // sort order within category
    hidden: { type: Boolean, default: false } // hidden achievements shown as ??? until unlocked
}, { timestamps: true });

achievementSchema.index({ category: 1, order: 1 });

const Achievement = mongoose.models.Achievement || mongoose.model('Achievement', achievementSchema);
export default Achievement;
