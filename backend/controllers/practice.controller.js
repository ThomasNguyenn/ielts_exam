import Writing from '../models/Writing.model.js';
import PracticeSession from '../models/PracticeSession.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPEN_API_KEY,
});

// Phase 1: Get Random Question
export const getRandomQuestion = async (req, res) => {
    try {
        // Ideally filtering for Task 2 (Essays) as per typical "Topic" practice
        const count = await Writing.countDocuments({ task_type: 'task2' });
        const random = Math.floor(Math.random() * count);
        const question = await Writing.findOne({ task_type: 'task2' }).skip(random);

        if (!question) {
            // Fallback if no task2 found, try any
            const anyQuestion = await Writing.findOne();
            if (!anyQuestion) return res.status(404).json({ message: "No questions found" });
            return res.json(anyQuestion);
        }

        res.json(question);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Phase 1: Check Outline
export const checkOutline = async (req, res) => {
    try {
        const { questionId, outline } = req.body;

        // 1. Fetch Question context
        const question = await Writing.findById(questionId);
        if (!question) return res.status(404).json({ message: "Question not found" });

        // 2. Call AI
        let prompt;

        if (question.task_type === 'task1' || question.type === 'task1') {
            prompt = `
              Act as an IELTS Examiner Band 8.0 for Writing Task 1 (Academic Report).
              Topic/Chart Prompt: ${question.prompt}
              
              Student Outline:
              - Report Structure (Overview strategy): ${outline.developmentMethod}
              - Key Features Identified: ${outline.mainIdeas.join(', ')}
              - Grouping Details (Body Paragraphs): ${outline.topicSentences.join(', ')}
              
              Tasks:
              1. Evaluate if the "Key Features" accurately cover the main trends/contrasts in the chart (implied by topic).
              2. Evaluate if the "Grouping Strategy" is logical (e.g. splitting by category or time).
              3. CRITICAL: If the outline misses the 'Overview' or just lists random numbers, give a low score.
              
              Output Requirements:
              - Feedback in VIETNAMESE.
              - Suggestions to improve data selection and grouping (Band 7+).
              - Score on a 0-100 scale based on Quality & Relevance.
        
              Return ONLY valid JSON in this format:
              {
                "general_feedback": "string (in Vietnamese)",
                "improvements": ["string (in Vietnamese)", "string"],
                "coherence_score": number (0-100)
              }
            `;
        } else {
            // Default to Task 2 (Essay)
            prompt = `
              Act as an IELTS Examiner Band 8.0.
              Topic: ${question.prompt}
              
              Student Outline:
              - Method: ${outline.developmentMethod}
              - Main Ideas: ${outline.mainIdeas.join(', ')}
              - Topic Sentences: ${outline.topicSentences.join(', ')}
              
              Tasks:
              1. Evaluate the relevance and depth of the ideas. 
              2. CRITICAL: If the outline is empty, vague, or off-topic, give a score < 30.
              3. If the ideas are generic or lack development, give a score < 50.
              
              Output Requirements:
              - Feedback in VIETNAMESE.
              - Suggestions to improve depth and coherence (Band 7+).
              - Score on a 0-100 scale based on Quality & Relevance.
        
              Return ONLY valid JSON in this format:
              {
                "general_feedback": "string (in Vietnamese)",
                "improvements": ["string (in Vietnamese)", "string"],
                "coherence_score": number (0-100)
              }
            `;
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });

        const aiResponse = JSON.parse(completion.choices[0].message.content);

        // 3. Save Session
        const session = new PracticeSession({
            questionId,
            outline,
            aiFeedback: aiResponse,
            status: 'ideation' // Or move to scaffolding?
        });

        await session.save();

        res.json({ session_id: session._id, feedback: aiResponse });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Phase 2: Generate Materials
export const generateMaterials = async (req, res) => {
    try {
        const { questionId } = req.params;
        const question = await Writing.findById(questionId);

        const prompt = `
      Topic: ${question.prompt}
      Generate learning materials for an IELTS Band 7+ essay on this topic.
      Return ONLY valid JSON:
      {
        "vocab": [ { "word": "string", "meaning": "string (in Vietnamese)", "collocation": "string" } ] (10 items),
        "structures": [ { "structure": "string", "example": "string" } ] (3 items),
        "translations": [ { "vietnamese": "string", "english_ref": "string" } ] (5 items, related to topic)
      }
    `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });

        const materials = JSON.parse(completion.choices[0].message.content);

        // Update session if sessionId is provided, else just return?
        // User flow: Ideation -> Scaffolding. We should ideally pass sessionId.
        // But for now, let's just return data. Frontent can save it when moving to next step or we update based on query?
        // Let's assume frontend calls this just to fetch data.

        res.json(materials);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Phase 3: Submit Writing
export const submitWriting = async (req, res) => {
    try {
        const { sessionId, fullEssay } = req.body;

        const session = await PracticeSession.findById(sessionId).populate('questionId');
        if (!session) return res.status(404).json({ message: "Session not found" });

        const question = session.questionId;

        const prompt = `
      Act as an IELTS Examiner.
      Topic: ${question.prompt}
      Student Essay: ${fullEssay}
      
      Tasks:
      1. Estimate Band Score (0-9) strictly following official IELTS criteria.
      2. Score 4 criteria: Task Response, Cohesion, Lexical, Grammar.
      3. Generate a complete Band 8.0 Model Essay for this topic (Ignore student's content for this part).
      4. Provide detailed feedback in VIETNAMESE.
      
      Return ONLY valid JSON in this format:
      {
        "band_score": number,
        "criteria_scores": { "task_response": number, "coherence_cohesion": number, "lexical_resource": number, "grammatical_range_accuracy": number },
        "corrected_essay": "string (The complete Band 8.0 Model Essay)",
        "feedback": ["string (in Vietnamese)"]
      }
    `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content);

        session.fullEssay = fullEssay;
        session.gradingResult = result;
        session.status = 'completed';
        await session.save();

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
