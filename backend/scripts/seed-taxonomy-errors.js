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

// --- TEMPLATES FOR RANDOM ERRORS ---

const READING_ERRORS = [
    { code: 'R-C4', category: 'C. Cognitive / Comprehension Errors', skill: 'R1. Literal Comprehension', explanation: 'Bẫy chi tiết. Bạn khớp từ vựng trùng lặp (keyword matching) thay vì hiểu nghĩa cả câu.' },
    { code: 'R-C3', category: 'C. Cognitive / Comprehension Errors', skill: 'R3. Synthesis & Evaluation', explanation: 'Nhầm lẫn ý chính. Bạn nhầm chi tiết phụ thành ý chính của đoạn văn.' },
    { code: 'R-C1', category: 'C. Cognitive / Comprehension Errors', skill: 'R1. Literal Comprehension', explanation: 'Chọn sai từ khóa. Dẫn đến đọc sai đoạn văn chứa thông tin.' },
    { code: 'R-C5', category: 'C. Cognitive / Comprehension Errors', skill: 'R2. Inferential Comprehension', explanation: 'Hiểu sai phạm vi (Scope Error). Đáp án quá rộng hoặc quá hẹp so với nội dung bài.' },
    { code: 'R-T1', category: 'T. TFNG/YNNG Specific Constraints', skill: 'R1. Literal Comprehension', explanation: 'Nhầm lẫn Sự thật vs Ý kiến trong bài True/False/Not Given.' },
    { code: 'R-T2', category: 'T. TFNG/YNNG Specific Constraints', skill: 'R3. Synthesis & Evaluation', explanation: 'Suy luận quá mức. Thông tin không có trong bài nhưng bạn tự suy diễn từ kiến thức bên ngoài.' },
    { code: 'R-A1', category: 'A. Answer-Level Errors', skill: 'R1. Literal Comprehension', explanation: 'Sai chính tả các từ học thuật.' },
    { code: 'R-A2', category: 'A. Answer-Level Errors', skill: 'R1. Literal Comprehension', explanation: 'Sai hình thức Số nhiều/Số ít (Plural/Singular).' },
];

const LISTENING_ERRORS = [
    { code: 'L-C4', category: 'C. Cognitive / Comprehension', skill: 'L2. Detail Recognition', explanation: 'Bạn chọn đáp án nghe thấy đầu tiên nhưng sau đó speaker đã đổi ý (Distractor trap).' },
    { code: 'L-C1', category: 'C. Cognitive / Comprehension', skill: 'L1. Detail Recognition', explanation: 'Nghe sót từ khóa quan trọng (Signal words).' },
    { code: 'L-A1', category: 'A. Answer-Level Errors', skill: 'L1. Detail Recognition', explanation: 'Sai chính tả khi chép chính tả (Dictation).' },
    { code: 'L-A2', category: 'A. Answer-Level Errors', skill: 'L1. Detail Recognition', explanation: 'Bạn thiếu âm "s" cuối từ vựng.' },
];

const WRITING_ERRORS = [
    { code: 'W2-G1', category: 'Grammar', skill: 'GRA. Grammar', explanation: 'Cố gắng sử dụng cấu trúc câu ghép nhưng sai hoàn toàn về mệnh đề.' },
    { code: 'W2-G3', category: 'Grammar', skill: 'GRA. Grammar', explanation: 'Lỗi viết câu quá dài (Run-on sentences) thiếu dấu câu hợp lý.' },
    { code: 'W2-L2', category: 'Vocabulary', skill: 'LR. Lexical Resource', explanation: 'Sử dụng từ vựng dịch word-by-word từ tiếng Việt, không tự nhiên trong ngữ cảnh (Sai Collocation).' },
    { code: 'W1-L1', category: 'Vocabulary', skill: 'LR. Lexical Resource', explanation: 'Từ vựng miêu tả xu hướng quá đơn giản hoặc bị lặp lại nhiều lần.' },
    { code: 'W2-C3', category: 'Coherence', skill: 'CC. Coherence', explanation: 'Nhảy ý đột ngột. Câu ghép không có từ nối logic hợp lý.' },
    { code: 'W1-T1', category: 'Task Achievement', skill: 'TA. Task Achievement', explanation: 'Viết Task 1 nhưng không có đoạn Overview tổng quan khái quát.' },
    { code: 'W2-T1', category: 'Task Response', skill: 'TR. Task Response', explanation: 'Không trả lời hết các vế của đề bài đưa ra.' },
];

const SPEAKING_ERRORS = [
    { code: 'S-F1', category: 'Fluency & Coherence', skill: 'FC. Fluency', explanation: 'Dừng chững lại ngập ngừng quá mức (Hesitation) để tìm từ vựng hoặc ý tưởng.' },
    { code: 'S-F2', category: 'Fluency & Coherence', skill: 'FC. Fluency', explanation: 'Lạm dụng quá mức các từ chêm (Fillers) như um, ah, you know.' },
    { code: 'S-P1', category: 'Pronunciation', skill: 'PR. Pronunciation', explanation: 'Nhấn sai trọng âm (Word Stress) của các từ đa âm tiết.' },
    { code: 'S-P2', category: 'Pronunciation', skill: 'PR. Pronunciation', explanation: 'Mất hoàn toàn âm đuôi s/ed (Ending sounds) khiến từ vựng bị thay đổi nghĩa.' },
    { code: 'S-G2', category: 'Grammar', skill: 'GRA. Grammar', explanation: 'Dùng sai thì cơ bản (Tense Error), ví dụ mô tả quá khứ nhưng dùng hiện tại đơn.' },
];

const randomDate = (start, end) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const getRandomItems = (arr, count) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

async function seedErrors() {
    try {
        console.log("Connecting to database...", MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB.");

        const user = await User.findOne({ email: "nminh1232001@gmail.com" }) || await User.findOne();

        if (!user) {
            console.error("No user found in the database. Please register a user first.");
            return;
        }

        console.log(`Targeting User: ${user.name} (${user.email} - ID: ${user._id})`);

        // Xóa hết dummy cũ để seed không bị chồng chéo quá mức
        await TestAttempt.deleteMany({ user_id: user._id, score: { $in: [5.0, 5.5] }, status: 'completed' });
        await WritingSubmission.deleteMany({ user_id: user._id, overallBand: { $in: [5.0, 5.5, 6.0] }, status: 'scored' });
        await SpeakingSession.deleteMany({ userId: user._id, overallBand: { $in: [5.0, 5.5] }, status: 'completed' });

        const docsToSave = [];
        const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const today = new Date();

        // ---------------------------------------------------------
        // 1. MASSIVE READING ATTEMPTS (20 bài)
        // ---------------------------------------------------------
        for (let i = 0; i < 20; i++) {
            const date = randomDate(threeMonthsAgo, today);
            const numErrors = Math.floor(Math.random() * 8) + 3; // 3 to 10 errors per test

            const error_logs = [];
            for (let e = 0; e < numErrors; e++) {
                const errTemplate = getRandomItems(READING_ERRORS, 1)[0];
                const taskType = getRandomItems(['tfng', 'matching_headings', 'note_completion', 'multiple_choice'], 1)[0];
                error_logs.push({
                    task_type: taskType,
                    cognitive_skill: errTemplate.skill,
                    error_category: errTemplate.category,
                    error_code: errTemplate.code,
                    explanation: errTemplate.explanation
                });
            }

            docsToSave.push(new TestAttempt({
                user_id: user._id,
                test_id: new mongoose.Types.ObjectId().toString(),
                status: 'completed',
                score: 5.0,
                startedAt: new Date(date.getTime() - 3600000),
                completedAt: date,
                submitted_at: date,
                type: 'reading',
                error_logs: error_logs
            }).save());
        }

        // ---------------------------------------------------------
        // 2. MASSIVE LISTENING ATTEMPTS (20 bài)
        // ---------------------------------------------------------
        for (let i = 0; i < 20; i++) {
            const date = randomDate(threeMonthsAgo, today);
            const numErrors = Math.floor(Math.random() * 6) + 3; // 3 to 8 errors per test

            const error_logs = [];
            for (let e = 0; e < numErrors; e++) {
                const errTemplate = getRandomItems(LISTENING_ERRORS, 1)[0];
                const taskType = getRandomItems(['multiple_choice', 'note_completion', 'map_labeling'], 1)[0];
                error_logs.push({
                    task_type: taskType,
                    cognitive_skill: errTemplate.skill,
                    error_category: errTemplate.category,
                    error_code: errTemplate.code,
                    explanation: errTemplate.explanation
                });
            }

            docsToSave.push(new TestAttempt({
                user_id: user._id,
                test_id: new mongoose.Types.ObjectId().toString(),
                status: 'completed',
                score: 5.5,
                startedAt: new Date(date.getTime() - 3600000),
                completedAt: date,
                submitted_at: date,
                type: 'listening',
                error_logs: error_logs
            }).save());
        }

        // ---------------------------------------------------------
        // 3. MASSIVE WRITING SUBMISSIONS (15 bài)
        // ---------------------------------------------------------
        for (let i = 0; i < 15; i++) {
            const date = randomDate(threeMonthsAgo, today);
            const numErrors = Math.floor(Math.random() * 7) + 4; // 4 to 10 errors per essay

            const error_logs = [];
            for (let e = 0; e < numErrors; e++) {
                const errTemplate = getRandomItems(WRITING_ERRORS, 1)[0];
                const taskType = errTemplate.code.startsWith('W1') ? 'task1' : 'task2';
                error_logs.push({
                    task_type: taskType,
                    cognitive_skill: errTemplate.skill,
                    error_category: errTemplate.category,
                    error_code: errTemplate.code,
                    explanation: errTemplate.explanation
                });
            }

            docsToSave.push(new WritingSubmission({
                user_id: user._id,
                test_id: new mongoose.Types.ObjectId().toString(),
                status: 'scored',
                student_name: user.name,
                student_email: user.email,
                writing_answers: [
                    { task_id: 'task1', answer_text: 'Mock Task 1 Content', word_count: 150 },
                    { task_id: 'task2', answer_text: 'Mock Task 2 Content', word_count: 250 }
                ],
                overallBand: 6.0,
                submitted_at: date,
                error_logs: error_logs
            }).save());
        }

        // ---------------------------------------------------------
        // 4. MASSIVE SPEAKING SESSIONS (15 bài)
        // ---------------------------------------------------------
        for (let i = 0; i < 15; i++) {
            const date = randomDate(threeMonthsAgo, today);
            const numErrors = Math.floor(Math.random() * 6) + 3; // 3 to 8 errors per speaking test

            const error_logs = [];
            for (let e = 0; e < numErrors; e++) {
                const errTemplate = getRandomItems(SPEAKING_ERRORS, 1)[0];
                const taskType = getRandomItems(['part1', 'part2', 'part3'], 1)[0];
                error_logs.push({
                    task_type: taskType,
                    cognitive_skill: errTemplate.skill,
                    error_category: errTemplate.category,
                    error_code: errTemplate.code,
                    explanation: errTemplate.explanation
                });
            }

            docsToSave.push(new SpeakingSession({
                userId: user._id,
                questionId: new mongoose.Types.ObjectId().toString(),
                status: 'completed',
                overallBand: 5.5,
                timestamp: date,
                error_logs: error_logs
            }).save());
        }

        // Execute all saves concurrently
        console.log(`Injecting ${docsToSave.length} dummy tests (Reading, Listening, Writing, Speaking) full of varied errors...`);
        await Promise.all(docsToSave);

        console.log("✅ SUPER MASSIVE SEED COMPLETED!");
        console.log(`👉 Added ${docsToSave.length} submissions with HUNDREDS of aggregated errors.`);
        console.log("👉 Go to Analytics -> Error Taxonomy to view the heatmap and rich AI insights.");

    } catch (err) {
        console.error("❌ Seeding failed:");
        if (err.errors) {
            for (let e in err.errors) {
                console.error("-", e, ":", err.errors[e].message);
            }
        } else {
            console.error(err);
        }
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
}

seedErrors();
