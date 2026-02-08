import Speaking from '../models/Speaking.model.js';
import SpeakingSession from '../models/SpeakingSession.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calculateWER, detectMissingEndings } from '../utils/textUtils.js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Use Gemini 2.0 Flash-Lite (Preview)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

// Phase 2: Transcribe and Analyze Speaking Answer (Gemini Multimodal + Metrics)
export const submitSpeaking = async (req, res) => {
    try {
        const { questionId, transcript: clientTranscript, wpm, metrics } = req.body;
        const audioFile = req.file;

        if (!audioFile) {
            return res.status(400).json({ message: "Audio file is required" });
        }

        const topic = await Speaking.findById(questionId);
        if (!topic) {
            return res.status(404).json({ message: "Speaking topic not found" });
        }

        // Parse metrics if sent as string
        const parsedMetrics = typeof metrics === 'string' ? JSON.parse(metrics) : metrics || {};
        const clientWPM = wpm || 0;

        // Perform Text Analysis if Reference exists (Read Aloud Mode)
        // OR if just checking general transcription quality
        let werScore = null;
        let missingEndings = [];
        let detailedDiff = [];

        // If your Topic model has a 'reference_text' or 'sample_answer' we can compare
        // Assuming topic.prompt is the question, maybe we don't have a strict reference text for generic speaking?
        // But for "Read Aloud", topic.prompt IS the text.
        // Let's assume if it is a "Read Aloud" type task, we compare.
        // For now, let's just log it or pass it to prompt.

        // Construct Prompt with RICH CONTEXT
        const prompt = `
          Act as an IELTS Speaking Examiner (Band 8.5+).
          Topic/Question: "${topic.prompt}"
          
          Student's Performance Metrics (Measured by system):
          - Estimated WPM (Words Per Minute): ${clientWPM} (Normal is 120-150)
          - Pauses: ${parsedMetrics.pauseCount || 0} times (Total pause: ${parsedMetrics.totalPauseDuration || 0}ms)
          - Client-side Transcript: "${clientTranscript || '(Voice only, no client text)'}"
          
          You are an expert English pronunciation coach and speech assessment engine (ELSA-style).
          You must produce actionable, learner-friendly feedback in Vietnamese.

          You will receive:
          - reference_text (optional, for read-aloud tasks)
          - transcript (ASR transcript of what the learner said)
          - metrics (speech rate WPM, pauses, fillers, WER, missing_endings flags, repetitions)
          - audio (The actual learner's voice recording)

          Rules:
          1) LISTEN to the audio for Intonation, Stress, and Pronunciation errors.
          2) Compare the audio with the transcript/reference_text to find mismatching sounds.
          3) If reference_text is provided, prioritize read-aloud scoring: word accuracy, missing endings (-s, -ed), function words, linking.
          4) Provide a Pronunciation Band Score plus sub-scores: word_accuracy, fluency, stress_intonation.
          5) Give: top 5 issues, word-level highlights, 5 drills, and a 30-second plan.
          6) Output ONLY valid JSON.
          7) Provide detailed feedback in VIETNAMESE.
          8) Suggest a Band 8.0+ Model Answer.
          
          Return ONLY valid JSON in this format:
          {
            "transcript": "string (The final accurate text)",
            "band_score": number,
            "fluency_coherence": { "score": number, "feedback": "string (Vietnamese)" },
            "lexical_resource": { "score": number, "feedback": "string (Vietnamese)" },
            "grammatical_range": { "score": number, "feedback": "string (Vietnamese)" },
            "pronunciation": { "score": number, "feedback": "string (Vietnamese)" },
            "general_feedback": "string (Vietnamese)",
            "sample_answer": "string (Model Answer)"
          }
        `;

        const audioPart = fileToGenerativePart(audioFile.path, audioFile.mimetype || "audio/webm");

        const result = await model.generateContent([prompt, audioPart]);
        const response = await result.response;
        const text = response.text();

        // Robust JSON Cleanup
        // 1. Remove markdown code blocks
        let jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // 2. Fix common JSON issues (unescaped newlines in strings)
        // This regex looks for newlines that are NOT followed by a control character or end of string, 
        // effectively trying to find newlines inside string values. 
        // A safer broad approach for Gemini: replace actual newlines with space or \n literal if inside a string?
        // Actually, easiest is to control the output via Prompt, but here we can try to sanitize.
        // Simple sanitizer: Replace line breaks with space if they break JSON?
        // Better: Use a dedicated repair, but for now let's just use a simple replace for control chars.
        // We replace standard newlines with \n literal only if they seem to be part of the content.

        // Use a simple function to strip bad control characters (0x00-0x1F) except allowed ones
        // jsonString = jsonString.replace(/[\x00-\x1F]+/g, (match) => {
        //    if (match === '\n' || match === '\r' || match === '\t') return match; // valid in whitespace
        //    return ''; 
        // });

        // Actually, JSON.parse fails on unescaped newlines INSIDE strings.
        // We can use a regex to escape them?
        // text.replace(/\n/g, "\\n") would escape ALL newlines, including formatted metadata.
        // Let's rely on a try-catch with a fallback "dirty" parser or just improved Prompt instruction (already done).

        // LET'S TRY: Just parsing. If fail, return text as feedback.
        let analysisResult;
        try {
            analysisResult = JSON.parse(jsonString);
        } catch (e) {
            console.error("JSON Parse Error:", e);
            console.log("Raw Text:", text);
            // Fallback: If it's valid text but invalid JSON, wrap it
            analysisResult = {
                transcript: "Error parsing AI response",
                general_feedback: text, // Return the raw text so user sees the feedback at least
                band_score: 0
            };
        }

        // 3. Save Session
        const session = new SpeakingSession({
            questionId,
            audioUrl: audioFile.path,
            transcript: analysisResult.transcript,
            analysis: analysisResult,
            metrics: {
                wpm: clientWPM,
                pauses: parsedMetrics
            },
            status: 'completed'
        });

        await session.save();

        res.json({ session_id: session._id, transcript: analysisResult.transcript, analysis: analysisResult });
    } catch (error) {
        console.error("Speaking AI Error:", error);
        res.status(500).json({ message: error.message });
    }
};
