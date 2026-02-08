import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Test from './models/Test.model.js';
import Passage from './models/Passage.model.js';
import Section from './models/Section.model.js';
import Writing from './models/Writing.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/ielts-app";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to DB");

        const tests = await Test.find({})
            .populate('reading_passages')
            .populate('listening_sections')
            .populate('writing_tasks')
            .lean();

        console.log(`Found ${tests.length} tests.`);

        for (const test of tests) {
            console.log(`\nTest: ${test.title} (_id: ${test._id})`);
            console.log(`Type: ${test.type}`);
            console.log(`Reading Passages: ${test.reading_passages?.length || 0}`);
            if (test.type === 'reading') {
                (test.reading_passages || []).forEach((p, i) => {
                    console.log(`  P${i + 1}: ${p ? p.title : 'NULL'}`);
                });
            }
            console.log(`Listening Sections: ${test.listening_sections?.length || 0}`);
            if (test.type === 'listening') {
                (test.listening_sections || []).forEach((s, i) => {
                    console.log(`  S${i + 1}: ${s ? s.title : 'NULL'}`);
                });
            }
            console.log(`Writing Tasks: ${test.writing_tasks?.length || 0}`);
            if (test.type === 'writing') {
                (test.writing_tasks || []).forEach((w, i) => {
                    console.log(`  W${i + 1}: ${w ? w.title : 'NULL'}`);
                });
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
