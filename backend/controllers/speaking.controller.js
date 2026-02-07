import Speaking from '../models/Speaking.model.js';
import SpeakingSession from '../models/SpeakingSession.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Helper to convert file to GoogleGenerativeAI.Part
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    },
  };
}

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

// Phase 2: Transcribe and Analyze Speaking Answer (Gemini Multimodal)
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

        // Prepare prompt
        const prompt = `
          Act as an IELTS Speaking Examiner (Band 8.5+).
          Topic/Question: ${topic.prompt}
          
          You will receive an audio file of the student's answer.
          
          Tasks:
          1. Transcribe the audio accurately.
          2. Provide a Band Score (0-9) based on official IELTS Speaking criteria.
          3. Evaluate 4 criteria:
             - Fluency and Coherence (Rate speed, pauses, hesitation, self-correction)
             - Lexical Resource (Vocabulary)
             - Grammatical Range and Accuracy
             - Pronunciation (Intonation, stress, clarity - CRITICAL)
          4. Provide detailed feedback in VIETNAMESE.
          5. Suggest a Band 8.0+ Model Answer for this question.
          
          Return ONLY valid JSON in this format:
          {
            "transcript": "string (The transcribed text)",
            "band_score": number,
            "fluency_coherence": { "score": number, "feedback": "string (in Vietnamese)" },
            "lexical_resource": { "score": number, "feedback": "string (in Vietnamese)" },
            "grammatical_range": { "score": number, "feedback": "string (in Vietnamese)" },
            "pronunciation": { "score": number, "feedback": "string (in Vietnamese)" },
            "general_feedback": "string (in Vietnamese)",
            "sample_answer": "string (The Band 8.0 Model Answer)"
          }
        `;

        const audioPart = fileToGenerativePart(audioFile.path, "audio/webm");

        const result = await model.generateContent([prompt, audioPart]);
        const response = await result.response;
        const text = response.text();
        
        // Clean up text if it contains markdown code blocks
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysisResult = JSON.parse(jsonString);

        // 3. Save Session
        const session = new SpeakingSession({
            questionId,
            audioUrl: audioFile.path,
            transcript: analysisResult.transcript,
            analysis: analysisResult,
            status: 'completed'
        });

        await session.save();

        res.json({ session_id: session._id, transcript: analysisResult.transcript, analysis: analysisResult });
    } catch (error) {
        console.error("Speaking AI Error:", error);
        res.status(500).json({ message: error.message });
    }
};
