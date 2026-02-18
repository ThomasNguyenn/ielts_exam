import OpenAI from 'openai';
import dotenv from 'dotenv';
import { requestOpenAIJsonWithFallback } from '../utils/aiClient.js';
import { PASSAGE_QUESTION_TYPES, SECTION_QUESTION_TYPES } from '../constants/questionTypes.js';
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const hasOpenAiCredentials = Boolean(OPENAI_API_KEY);

const OPENAI_MODELS = [
    process.env.OPENAI_PRIMARY_MODEL || "gpt-4o",
    process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini",
];

/**
 * Parses raw text/images into a structured Passage or Section object.
 * @param {string} rawText - The raw text content (if any)
 * @param {string[]} imageUrls - Array of image URLs (if any)
 * @param {string} type - 'passage' (Reading) or 'section' (Listening)
 */
export const parseContent = async (rawText, imageUrls = [], type = 'passage') => {
    const isPassage = type === 'passage';
    const allowedTypes = isPassage ? PASSAGE_QUESTION_TYPES : SECTION_QUESTION_TYPES;
    const enumListText = allowedTypes.map((value) => `'${value}'`).join(', ');
    
    // Define the specific schema structure based on the model type
    const systemPrompt = `
You are an expert IELTS content digitizer. Your job is to convert raw text and images of IELTS ${isPassage ? 'Reading Passages' : 'Listening Sections'} into a strict JSON format valid for a database.

**GOAL**: Output a SINGLE JSON object that matches the '${isPassage ? 'Passage' : 'Section'}' schema below.

**SCHEMA STRUCTURE**:
{
  "title": "string",
  "content": "string (The main reading text or listening transcript)",
  ${!isPassage ? '"audio_url": "string (Leave empty or placeholder if unknown)",' : ''}
  "source": "string (e.g. Cambridge 18 Test 1)",
  "question_groups": [
    {
      "type": "string (ENUM: ${enumListText})",
      "instructions": "string (Optional instructions)",
      "text": "string (Optional: Only for split summary/gap-fill text or map image URL)",
      "headings": [ { "id": "string", "text": "string" } ], // For matching_headings or matching_features
      "options": [ { "id": "string", "text": "string" } ], // For summary_completion list options or Map labels
      "questions": [
        {
          "q_number": number,
          "text": "string (Question text. IMPORTANT: For gap-fill/summary, this is usually empty or small context)",
          "option": [ { "label": "A", "text": "string" }, { "label": "B", "text": "string" }, ... ], // For Multiple Choice
          "correct_answers": ["string"], // Array of correct answers (e.g. ["A"], ["TRUE"], ["car", "cars"])
          "explanation": "string (Optional explanation)"
        }
      ]
    }
  ]
}

**RULES FOR PARSING**:
1. **Detect Question Types**:
   - Multiple Choice: 'mult_choice'
   - True/False/Not Given: 'true_false_notgiven'
   - Yes/No/Not Given: 'yes_no_notgiven'
   - Filling in blanks:
     - Sentence completion: 'sentence_completion'
     - Form completion: 'form_completion'
     - Note completion: 'note_completion'
     - Table completion: 'table_completion'
     - Flow-chart completion: 'flow_chart_completion'
     - Diagram label completion: 'diagram_label_completion'
     - Standard fallback: 'note_completion' (legacy alias: 'gap_fill')
   - Matching Headings to paragraphs: 'matching_headings'
   - Matching Information: 'matching_info' (or legacy 'matching_information')
   - Matching Features: 'matching_features'
   - Matching Sentence Endings: 'matching_sentence_endings'
   - Summary with word list OR without: 'summary_completion'
   - Short answer questions: 'short_answer'
   ${!isPassage ? "- Generic listening matching blocks: 'matching'" : ""}
   ${!isPassage ? "- Labeling a plan/map/diagram: 'plan_map_diagram' or 'listening_map'" : ""}

2. **Handle Gap Fills / Summary Completion**:
   - If the raw text has "[...]" or "______" indicating gaps, replace them with "[number]" corresponding to the question number if possible, or just parse the questions.
   - Ideally, put the "Summary Title" and the "Summary Text" (with gaps replaced by [q_num] or similar placeholders if the UI expects it, but our UI usually renders questions. Check the 'text' field in question_group for the summary text itself if needed).
   - *CRITICAL*: For 'summary_completion' or 'note_completion' (legacy 'gap_fill'), putting the main text with holes into the 'text' field of the question_group is BEST. The 'questions' array will then contain the answers for each gap number.

3. **Handle Matching**:
   - 'matching_headings': Put the list of Headings (i, ii, iii...) into the 'headings' array. The questions will normally be "Paragraph A", "Paragraph B" etc. (q_number: 1, text: "Paragraph A").
   - 'matching_features': Put the list of People/Features (A, B, C...) into the 'headings' (or 'options' - wait, schema uses 'headings' or 'options' generally? Code uses 'headings' for matching features too in frontend logic often, but check carefully. Use 'headings' for the list of features/people to match).

4. **Correct Answers**:
   - If the correct answers are provided in the input, fill 'correct_answers'.
   - If NOT provided, leave 'correct_answers' as empty array or ["?"] so the user knows to fill it.

5. **Content**:
   - If the input is just questions, leave "content" as "To be added".
   - If input includes the main reading passage, put it in "content".

6. **Images**:
   - If an image is provided, use it to extract the text and structure.
   - For 'listening_map', if the image IS the map itself, you can't really upload it here. just put a placeholder URL in the 'text' field if the schema uses 'text' for map url.

7. **JSON Only**:
   - Output PURE JSON. No markdown fences if possible, or just standard code block.

`;

    const messages = [
        { role: "system", content: systemPrompt },
        { 
            role: "user", 
            content: [
                { type: "text", text: rawText || "Please parse the following images into the structure." },
                ...imageUrls.map(url => ({
                    type: "image_url",
                    image_url: { url }
                }))
            ] 
        }
    ];

    try {
        if (!hasOpenAiCredentials) {
            throw new Error("OpenAI API key is not configured");
        }
        const aiResult = await requestOpenAIJsonWithFallback({
            openai,
            models: OPENAI_MODELS,
            createPayload: (model) => ({
                model,
                messages,
                max_tokens: 4096,
                response_format: { type: "json_object" }
            }),
            timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 45000),
            maxAttempts: Number(process.env.OPENAI_MAX_ATTEMPTS || 3),
        });

        return aiResult.data;
    } catch (error) {
        console.error("Content Gen Error:", error);
        return {
            title: "AI parsing unavailable",
            content: rawText || "",
            source: "fallback",
            question_groups: [],
        };
    }
};
