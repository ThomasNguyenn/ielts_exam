import mongoose from 'mongoose';
import TestAttempt from './models/TestAttempt.model.js';
import Test from './models/Test.model.js';
import User from './models/User.model.js';
// import app from './server.js'; // Removed to avoid side effects
import { getWeaknessAnalysis, getSkillsBreakdown } from './controllers/analytics.controller.js';

// Mock Req/Res
const mockReq = (userId) => ({
    user: { userId },
    params: { studentId: userId }
});

const mockRes = () => {
    const res = {};
    res.json = (data) => { res.data = data; return res; };
    res.status = (code) => { res.statusCode = code; return res; };
    return res;
};

async function verify() {
    console.log("Connecting to DB...");
    const uri = "mongodb+srv://nminhduc843_db_user:6MR3STMQw2ddeVaH@ieltsexam.irmsvzd.mongodb.net/TestBank?appName=IeltsExam";
    await mongoose.connect(uri);

    try {
        // 1. Find or Create a Test User
        let user = await User.findOne({ email: 'analytics_test@example.com' });
        if (!user) {
            user = await User.create({
                name: 'Analytics Tester',
                email: 'analytics_test@example.com',
                password: 'password123',
                role: 'student'
            });
        }
        console.log("User ID:", user._id);

        // 2. Create a Mock TestAttempt with detailed_answers
        console.log("Creating Mock TestAttempt...");
        await TestAttempt.create({
            user_id: user._id,
            test_id: 'mock-test-id',
            type: 'reading',
            score: 5,
            total: 10,
            wrong: 5,
            percentage: 50,
            detailed_answers: [
                { question_number: 1, question_type: 'multiple_choice', is_correct: true, user_answer: 'A', correct_answer: 'A' },
                { question_number: 2, question_type: 'multiple_choice', is_correct: false, user_answer: 'B', correct_answer: 'C' },
                { question_number: 3, question_type: 'true_false_not_given', is_correct: true, user_answer: 'true', correct_answer: 'true' },
                { question_number: 4, question_type: 'true_false_not_given', is_correct: false, user_answer: 'false', correct_answer: 'true' },
            ]
        });

        // 3. Test Weakness Analysis
        console.log("Testing Weakness Analysis Endpoint...");
        const req = mockReq(user._id.toString());
        const resWeak = mockRes();
        await getWeaknessAnalysis(req, resWeak);

        console.log("Weakness Result:", JSON.stringify(resWeak.data, null, 2));

        if (!resWeak.data.weaknesses || resWeak.data.weaknesses.length === 0) {
            console.error("FAILED: No weaknesses returned.");
        } else {
            console.log("PASSED: Weaknesses returned.");
        }

        // 4. Test Skills Breakdown
        console.log("Testing Skills Breakdown Endpoint...");
        const resSkills = mockRes();
        await getSkillsBreakdown(req, resSkills);

        console.log("Skills Result:", JSON.stringify(resSkills.data, null, 2));
        if (!resSkills.data.skills) {
            console.error("FAILED: No skills returned.");
        } else {
            console.log("PASSED: Skills returned.");
        }

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        await mongoose.connection.close();
    }
}

verify();
