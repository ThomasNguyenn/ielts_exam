import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { evaluateObjectiveErrorsAsync } from '../services/taxonomy.service.js';
import TestAttempt from '../models/TestAttempt.model.js';

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/ielts_app";

async function testTaxonomy() {
    await mongoose.connect(MONGO_URI);

    // Create a dummy attempt
    const attempt = await TestAttempt.create({
        user_id: new mongoose.Types.ObjectId(),
        test_id: new mongoose.Types.ObjectId().toString(),
        type: 'reading',
        score: 5,
        total: 10,
        percentage: 50,
        error_logs: []
    });

    const questionReview = [
        {
            question_number: 1,
            type: 'true_false_not_given',
            question_text: "The sky is blue.",
            your_answer: "false",
            correct_answer: "not given",
            is_correct: false,
            options: []
        },
        {
            question_number: 2,
            type: 'multiple_choice',
            question_text: "What is the capital of France?",
            your_answer: "London",
            correct_answer: "Paris",
            is_correct: false,
            options: ["Paris", "London", "Berlin"]
        }
    ];

    try {
        console.log("Running evaluateObjectiveErrorsAsync...");
        await evaluateObjectiveErrorsAsync(attempt._id, questionReview, 'reading', ['The sky']);

        const updated = await TestAttempt.findById(attempt._id).lean();
        console.log("Finished! error_logs length:", updated.error_logs?.length);
        console.log(JSON.stringify(updated.error_logs, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.connection.close();
    }
}

testTaxonomy();
