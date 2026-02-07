import Speaking from '../models/Speaking.model.js';
import SpeakingSession from '../models/SpeakingSession.js';
import Groq from 'groq-sdk';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Phase 1: Get Random Speaking Topic
export const getRandomSpeaking = async (req, res) => {
    try {
        const count = await Speaking.countDocuments({ is_active: true });
        const random = Math.floor(Math.random() * count);
        const topic = await Speaking.findOne({ is_active: true }).skip(random);

        if (!topic) {
            return res.status(404).json({ message: "No speaking topics found" });
        }

        res.json(topic);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get All Speaking Topics
export const getSpeakings = async (req, res) => {
    try {
        const topics = await Speaking.find({ is_active: true }).sort({ created_at: -1 });
        res.json({ success: true, data: topics });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Speaking by ID
export const getSpeakingById = async (req, res) => {
    try {
        const topic = await Speaking.findById(req.params.id);
        if (!topic) {
            return res.status(404).json({ message: "Speaking topic not found" });
        }
        res.json(topic);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create Speaking Topic
export const createSpeaking = async (req, res) => {
    try {
        const newTopic = new Speaking(req.body);
        const savedTopic = await newTopic.save();
        res.status(201).json(savedTopic);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update Speaking Topic
export const updateSpeaking = async (req, res) => {
    try {
        const updatedTopic = await Speaking.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updatedTopic) {
            return res.status(404).json({ message: "Speaking topic not found" });
        }
        res.json(updatedTopic);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete Speaking Topic
export const deleteSpeaking = async (req, res) => {
    try {
        const topic = await Speaking.findByIdAndDelete(req.params.id);
        if (!topic) {
            return res.status(404).json({ message: "Speaking topic not found" });
        }
        res.json({ message: "Speaking topic deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Phase 2: Transcribe and Analyze Speaking Answer
export const submitSpeaking = async (req, res) => {
    try {
        const { questionId } = req.body;
        const audioFile = req.file;

        if (!audioFile) {
            return res.status(400).json({ message: "Audio file is required" });
        }

        const topic = await Speaking.findById(questionId);
        if (!topic) {
            return res.status(404).json({ message: "Speaking topic not found" });
        }

        // 1. Transcribe via Groq Whisper
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(audioFile.path),
            model: "whisper-large-v3",
            language: "en",
        });

        const transcriptText = transcription.text;

        // 2. Analyze via Groq Llama 3
        const prompt = `
          Act as an IELTS Speaking Examiner (Band 8.5+).
          Topic/Question: ${topic.prompt}
          Student's Spoken Answer (Transcript): "${transcriptText}"
          
          Tasks:
          1. Provide a Band Score (0-9) based on official IELTS Speaking criteria.
          2. Evaluate 4 criteria:
             - Fluency and Coherence
             - Lexical Resource (Vocabulary)
             - Grammatical Range and Accuracy
             - Pronunciation (Based on transcript clarity/flow)
          3. Provide detailed feedback in VIETNAMESE.
          4. Suggest a Band 8.0+ Model Answer for this question.
          
          Return ONLY valid JSON in this format:
          {
            "band_score": number,
            "fluency_coherence": { "score": number, "feedback": "string (in Vietnamese)" },
            "lexical_resource": { "score": number, "feedback": "string (in Vietnamese)" },
            "grammatical_range": { "score": number, "feedback": "string (in Vietnamese)" },
            "pronunciation": { "score": number, "feedback": "string (in Vietnamese)" },
            "general_feedback": "string (in Vietnamese)",
            "sample_answer": "string (The Band 8.0 Model Answer)"
          }
        `;

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });

        const analysisResult = JSON.parse(completion.choices[0].message.content);

        // 3. Save Session
        const session = new SpeakingSession({
            questionId,
            audioUrl: audioFile.path,
            transcript: transcriptText,
            analysis: analysisResult,
            status: 'completed'
        });

        await session.save();

        res.json({ session_id: session._id, transcript: transcriptText, analysis: analysisResult });
    } catch (error) {
        console.error("Speaking AI Error:", error);
        res.status(500).json({ message: error.message });
    }
};
