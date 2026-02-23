import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert import.meta.url for path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../models/User.model.js';
import TestAttempt from '../models/TestAttempt.model.js';
import WritingSubmission from '../models/WritingSubmission.model.js';
import SpeakingSession from '../models/SpeakingSession.js';

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/ielts_app";

async function clearDummySeed() {
    try {
        console.log("Connecting to database...", MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB.");

        const user = await User.findOne({ email: "nminhduc843@gmail.com" }) || await User.findOne();

        if (!user) {
            console.error("No user found in the database. Please register a user first.");
            return;
        }

        console.log(`Targeting User: ${user.name} (${user.email} - ID: ${user._id})`);
        console.log("🗑️  Bắt đầu dọn dẹp dữ liệu ảo (Dummy Seed Data)...");

        // XOÁ TEST ATTEMPT (Reading / Listening - xoá mọi bài có error log)
        const deletedTests = await TestAttempt.deleteMany({
            "error_logs.0": { $exists: true }
        });

        // XOÁ WRITING SUBMISSION (xoá mọi bài có error log)
        const deletedWritings = await WritingSubmission.deleteMany({
            "error_logs.0": { $exists: true }
        });

        // XOÁ SPEAKING SESSION (xoá mọi bài có error log)
        const deletedSpeakings = await SpeakingSession.deleteMany({
            "error_logs.0": { $exists: true }
        });

        console.log(`✅ Xoá thành công:`);
        console.log(`- ${deletedTests.deletedCount} bài thi Reading / Listening ảo`);
        console.log(`- ${deletedWritings.deletedCount} bài thi Writing ảo`);
        console.log(`- ${deletedSpeakings.deletedCount} phiên Speaking ảo`);

        console.log("✨ Mọi dữ liệu thử nghiệm AI Insights đã dọn dẹp sạch sẽ, không ảnh hưởng đến dữ liệu thực.");

    } catch (err) {
        console.error("❌ Xóa thất bại:", err);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
}

clearDummySeed();
