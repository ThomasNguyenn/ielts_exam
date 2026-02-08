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
                Act as a certified IELTS Writing Examiner with at least 10 years of experience.
                Your evaluation standard must strictly follow IELTS Writing Task 2 Band Descriptors,
                especially the criterion: TASK RESPONSE.
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
        const { sessionId, fullEssay, gradingMode = 'ai' } = req.body; // gradingMode: 'ai' | 'standard'

        const session = await PracticeSession.findById(sessionId).populate('questionId');
        if (!session) return res.status(404).json({ message: "Session not found" });

        session.fullEssay = fullEssay;

        if (gradingMode === 'standard') {
            // Standard submission: No AI grading, just save
            session.gradingResult = null;
            session.status = 'completed';
            await session.save();

            return res.json({
                gradingMode: 'standard',
                message: "Essay submitted successfully."
            });
        }

        // AI Grading Logic
        const question = session.questionId;

        const prompt = `
      Act as a certified IELTS Writing Examiner with at least 10 years of experience.
      Your evaluation standard must strictly follow IELTS Writing Task 2 Band Descriptors,
      especially the criterion: TASK RESPONSE.  
      Topic: ${question.prompt}
      Student Essay: ${fullEssay}
      

      - If the student provides ONLY the essay question or a single sentence
        WITHOUT clear ideas, position, or outline elements,
        DO NOT evaluate as an IELTS outline.

        - In this case:
        + Set score between 1-2
        + Clearly state that the student has NOT yet provided an outline
        + Ask the student to provide:
          - their opinion
          - main ideas
          - or topic sentences

      Evaluation Guidelines (STRICT):

      1. Relevance & Task Response
      - Check whether the ideas directly answer ALL parts of the question.
      - Penalize heavily if ideas are off-topic, partially relevant, or misunderstand the task.

      2. Depth & Development
      - Assess whether ideas are specific, explained, and logically expandable.
      - Generic ideas without explanation = weak development.

      3. Logical Structure & Coherence
      - Evaluate clarity of progression from ideas → topic sentences → potential body paragraphs.
      - Check consistency between development method and ideas.

      Scoring Rules (CRITICAL – DO NOT IGNORE):
      - If the outline is EMPTY, extremely vague, or clearly off-topic → score MUST be BELOW 30.
      - If ideas are relevant but generic, underdeveloped, or repetitive → score MUST be BELOW 50.
      - Scores ABOVE 6 are ONLY allowed if ideas are:
      + clearly relevant
      + well-developed
      + specific (not memorized IELTS clichés)
      + logically structured

      Scoring Interpretation base on IELTS Marking Criteria Task 2:
      - 1-3   : Very weak (≈ IELTS Band 3–4)
      - 3-5  : Limited (≈ IELTS Band 5)
      - 5-6  : Adequate but underdeveloped (≈ IELTS Band 6)
      - 6-7  : Strong and clear (≈ IELTS Band 7)
      - 7-8 : Very strong, flexible, and insightful (≈ IELTS Band 8+)

      Output Requirements:
      - Tone: professional, analytical, like a real IELTS examiner.
      - Clearly state WHY the score was given.
      - Provide practical suggestions and show their grammar and vocabulary mistakes to help the student reach Band 7+.
      
      Return ONLY valid JSON in this format:
      {
        "band_score": number,
        "criteria_scores": { "task_response": number, "coherence_cohesion": number, "lexical_resource": number, "grammatical_range_accuracy": number },
        "corrected_essay": "string (The complete Band 8.0 Model Essay)",
        "feedback": ["string (General feedback in Vietnamese)"],
        "detailed_analysis": [
            {
                "text_snippet": "string (Exact text from student essay)",
                "type": "error" | "good" | "suggestion",
                "comment": "string (Explanation in Vietnamese)",
                "correction": "string (Optional correction)"
            }
        ]
      }
    `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content);

        session.gradingResult = result;
        session.status = 'completed';
        await session.save();

        res.json({ ...result, fullEssay, gradingMode: 'ai' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
