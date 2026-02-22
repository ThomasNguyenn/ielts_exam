import mongoose from 'mongoose';

const XpTransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    source: { type: String, default: 'general' }, // e.g. 'test', 'writing', 'speaking', 'achievement', 'vocab'
}, { timestamps: true });

// Index for daily aggregation queries
XpTransactionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('XpTransaction', XpTransactionSchema);
