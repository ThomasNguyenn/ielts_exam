import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert import.meta.url for path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Assuming your models are here
import User from '../models/User.model.js';
import TestAttempt from '../models/TestAttempt.model.js';
import WritingSubmission from '../models/WritingSubmission.model.js';
// Note: Fallback import logic in case the name is different
import SpeakingSession from '../models/SpeakingSession.js';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ielts_app";

async function seedErrors() {
    try {
        console.log("Connecting to database...", MONGODB_URI);
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB.");

        // 1. Find a target user (grab the first Admin or Student)
        const user = await User.findOne({ email: "nminh1232001@gmail.com" }) || await User.findOne();

        if (!user) {
            console.error("No user found in the database. Please register a user first.");
            return;
        }

        console.log(`Targeting User: ${user.name} (${user.email} - ID: ${user._id})`);

        // Array to hold our mock documents
        const docsToSave = [];

        // ---------------------------------------------------------
        // 1. DUMMY READING/LISTENING TEST ATTEMPT
        // ---------------------------------------------------------
        const testAttempt = new TestAttempt({
            user: user._id,
            test: new mongoose.Types.ObjectId(), // Fake test ID
            status: 'completed',
            score: 5.5,
            startedAt: new Date(Date.now() - 86400000 * 2),
            completedAt: new Date(Date.now() - 86400000 * 2 + 3600000), // 1 hour later
            type: 'reading',
            error_logs: [
                {
                    task_type: 'matching_headings',
                    cognitive_skill: 'R3. Synthesis & Evaluation',
                    error_category: 'C. Cognitive / Comprehension Errors',
                    error_code: 'R-C3', // Main Idea Confusion
                    question_number: 14,
                    user_answer: 'viii',
                    correct_answer: 'v',
                    explanation: 'Hệ thống tự động phân loại: Bạn đã nhầm lẫn ý chính của đoạn văn (R-C3). Đoạn này tập trung vào tác động thay vì nguyên nhân.',
                    meta_error: 'X2 Time Pressure'
                },
                {
                    task_type: 'matching_headings',
                    cognitive_skill: 'R3. Synthesis & Evaluation',
                    error_category: 'C. Cognitive / Comprehension Errors',
                    error_code: 'R-C4', // Detail Trap
                    question_number: 15,
                    user_answer: 'ii',
                    correct_answer: 'x',
                    explanation: 'Hệ thống tự động phân loại: Bạn đã rơi vào bẫy chi tiết (R-C4) do từ vựng giống hệt trong bài đọc.',
                },
                {
                    task_type: 'tfng',
                    cognitive_skill: 'R1. Literal Comprehension',
                    error_category: 'T. TFNG/YNNG Specific Constraints',
                    error_code: 'R-T1', // Fact vs. Opinion
                    question_number: 3,
                    user_answer: 'TRUE',
                    correct_answer: 'NOT GIVEN',
                    explanation: 'Hệ thống tự động phân loại: Lỗi TFNG cơ bản. Thông tin này là một giả thuyết, không phải sự thật được đề cập.',
                },
                {
                    task_type: 'note_completion',
                    cognitive_skill: 'R1. Literal Comprehension',
                    error_category: 'A. Answer-Level Errors',
                    error_code: 'R-A1', // Spelling
                    question_number: 28,
                    user_answer: 'enviroment',
                    correct_answer: 'environment',
                    explanation: 'Hệ thống tự động phân loại: Sai chính tả từ "environment".'
                },
                {
                    task_type: 'note_completion',
                    cognitive_skill: 'R1. Literal Comprehension',
                    error_category: 'A. Answer-Level Errors',
                    error_code: 'R-A1', // Spelling again (to bump the frequency heatmap)
                    question_number: 29,
                    user_answer: 'accomodation',
                    correct_answer: 'accommodation',
                    explanation: 'Hệ thống tự động phân loại: Sai chính tả từ "accommodation".'
                }
            ]
        });
        docsToSave.push(testAttempt.save());

        // ---------------------------------------------------------
        // 2. DUMMY WRITING SUBMISSION
        // ---------------------------------------------------------
        const writingSubmission = new WritingSubmission({
            user: user._id,
            test: new mongoose.Types.ObjectId(), // Fake test ID
            status: 'graded',
            overallBand: 6.0,
            submittedAt: new Date(Date.now() - 86400000),
            task1: { answer: "Mock Task 1", wordCount: 150 },
            task2: { answer: "Mock Task 2", wordCount: 250 },
            error_logs: [
                {
                    task_type: 'task2',
                    cognitive_skill: 'TR. Task Response',
                    error_category: 'Task 2 Task Response',
                    error_code: 'W2-T1', // Unanswered Parts 
                    text_snippet: 'The government should do this...',
                    explanation: 'AI Feedback: Bạn chỉ trả lời được một vế của câu hỏi, bỏ qua phần ý kiến cá nhân.',
                },
                {
                    task_type: 'task2',
                    cognitive_skill: 'GRA. Grammar',
                    error_category: 'Grammar',
                    error_code: 'W2-G1', // Complex Sentence Error
                    text_snippet: 'Because it is hard, so people avoid it.',
                    explanation: 'AI Feedback: Lỗi cấu trúc câu phức. Không dùng "so" sau "because" trong tiếng Anh.',
                },
                {
                    task_type: 'task2',
                    cognitive_skill: 'GRA. Grammar',
                    error_category: 'Grammar',
                    error_code: 'W2-G1', // Complex Sentence Error
                    text_snippet: 'Despite of the rain...',
                    explanation: 'AI Feedback: Dùng sai giới từ "despite".'
                },
                {
                    task_type: 'task1',
                    cognitive_skill: 'TA. Task Achievement',
                    error_category: 'Task 1 Task Achievement',
                    error_code: 'W1-T1', // Missing Overview
                    text_snippet: 'Overall, ... (missing entirely)',
                    explanation: 'AI Feedback: Bạn không viết đoạn Overview rõ ràng mô tả xu hướng chính của biểu đồ.',
                },
                {
                    task_type: 'task1',
                    cognitive_skill: 'LR. Lexical Resource',
                    error_category: 'Vocabulary',
                    error_code: 'W1-L1', // Weak Trend Vocab
                    text_snippet: 'The line goes up very fast.',
                    explanation: 'AI Feedback: Cần dùng từ vựng học thuật hơn để diễn tả xu hướng (ví dụ: rocketed, surged).',
                }
            ]
        });
        docsToSave.push(writingSubmission.save());

        // ---------------------------------------------------------
        // 3. DUMMY SPEAKING SESSION
        // ---------------------------------------------------------
        const speakingSession = new SpeakingSession({
            user: user._id,
            modelTest: new mongoose.Types.ObjectId(), // Fake test ID
            status: 'completed',
            overallBand: 5.5,
            startedAt: new Date(),
            completedAt: new Date(Date.now() + 900000), // 15 mins later
            error_logs: [
                {
                    task_type: 'part1',
                    cognitive_skill: 'FC. Fluency',
                    error_category: 'Fluency & Coherence',
                    error_code: 'S-F1', // Hesitation
                    text_snippet: 'Well... uhm... yes, I think...',
                    explanation: 'AI Feedback: Bạn ngập ngừng và dùng quá nhiều từ đệm khi tìm ý.',
                },
                {
                    task_type: 'part2',
                    cognitive_skill: 'FC. Fluency',
                    error_category: 'Fluency & Coherence',
                    error_code: 'S-F1', // Hesitation
                    text_snippet: 'And then... uh... we...',
                    explanation: 'AI Feedback: Lại xuất hiện lỗi ngập ngừng ở Part 2, gây gián đoạn luồng nói.',
                },
                {
                    task_type: 'part2',
                    cognitive_skill: 'PR. Pronunciation',
                    error_category: 'Pronunciation',
                    error_code: 'S-P2', // Missing Endings
                    text_snippet: 'I walk to school.', // supposed to be walked
                    explanation: 'AI Feedback: Bạn nuốt mất âm đuôi "-ed" của động từ quá khứ.',
                },
                {
                    task_type: 'part3',
                    cognitive_skill: 'GRA. Grammar',
                    error_category: 'Grammar',
                    error_code: 'S-G2', // Tense Inconsistency
                    text_snippet: 'In the past, people use cars.',
                    explanation: 'AI Feedback: Bạn dùng sai thì. Phải là "used" trong ngữ cảnh nói về quá khứ.',
                }
            ]
        });
        docsToSave.push(speakingSession.save());

        // Execute saves
        await Promise.all(docsToSave);

        console.log("✅ Seed completed successfully! Added mock logs to TestAttempt, WritingSubmission, and SpeakingSession.");
        console.log("👉 Go to the Dashboard -> Error Taxonomy map to view the results.");

    } catch (err) {
        console.error("❌ Seeding failed:", err);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
}

seedErrors();
