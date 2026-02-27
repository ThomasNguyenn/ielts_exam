import mongoose from "mongoose";
import { randomBytes } from "crypto";

const invitationSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    role: {
        type: String,
        enum: ["teacher", "admin"],
        required: true,
    },
    token: {
        type: String,
        required: true,
        unique: true,
        default: () => randomBytes(32).toString("hex"),
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "expired"],
        default: "pending",
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    acceptedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

invitationSchema.index({ email: 1, status: 1 });
invitationSchema.index({ expiresAt: 1 });

const Invitation = mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);
export default Invitation;
