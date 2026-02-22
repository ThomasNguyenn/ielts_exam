import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env explicitly
dotenv.config({ path: path.join(__dirname, '.env') });

import Speaking from './models/Speaking.model.js';

const connectDB = async () => {
    try {
        console.log('Connecting to MongoDB...', process.env.MONGO_URI ? 'URI Found' : 'URI Missing');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected successfully');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

import fs from 'fs';

const logFile = path.join(__dirname, 'verify_output.txt');
const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
};

const verifySpeakings = async () => {
    fs.writeFileSync(logFile, ''); // Clear file
    log('Starting verification...');
    await connectDB();

    try {
        log('Fetching topics...');
        const topics = await Speaking.find({});
        log(`Found ${topics.length} speaking topics.`);

        topics.forEach(t => {
            log('------------------------------------------------');
            log(`ID: ${t._id}`);
            log(`Title (Raw): [${t.title}]`);
            log(`Title (Escaped): ${JSON.stringify(t.title)}`);
            log('------------------------------------------------');
        });

    } catch (error) {
        log(`Error fetching topics: ${error}`);
    } finally {
        log('Closing connection...');
        await mongoose.connection.close();
        log('Done.');
    }
};

verifySpeakings();
