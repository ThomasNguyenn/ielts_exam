import OpenAI from 'openai';
import dotenv from 'dotenv';
import { requestOpenAIJsonWithFallback } from '../utils/aiClient.js';
import { PASSAGE_QUESTION_TYPES, QUESTION_GROUP_LAYOUTS, SECTION_QUESTION_TYPES } from '../constants/questionTypes.js';
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const hasOpenAiCredentials = Boolean(OPENAI_API_KEY);

const OPENAI_MODELS = [
    process.env.OPENAI_PRIMARY_MODEL || "gpt-4o",
    process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini",
];

const COMPLETION_TYPES = new Set([
    'sentence_completion',
    'form_completion',
    'note_completion',
    'table_completion',
    'flow_chart_completion',
    'diagram_label_completion',
    'summary_completion',
    'gap_fill',
]);

const MATCHING_TYPES = new Set([
    'matching',
    'matching_headings',
    'matching_features',
    'matching_sentence_endings',
    'matching_info',
    'matching_information',
]);

const BOOLEAN_TYPES = new Set([
    'true_false_notgiven',
    'yes_no_notgiven',
]);

const BOOLEAN_OPTIONS_BY_TYPE = {
    true_false_notgiven: ['TRUE', 'FALSE', 'NOT GIVEN'],
    yes_no_notgiven: ['YES', 'NO', 'NOT GIVEN'],
};

const GROUP_LAYOUT_SET = new Set(QUESTION_GROUP_LAYOUTS);

const TYPE_ALIASES = {
    // Canonical
    true_false_notgiven: 'true_false_notgiven',
    yes_no_notgiven: 'yes_no_notgiven',
    mult_choice: 'mult_choice',
    summary_completion: 'summary_completion',
    note_completion: 'note_completion',
    form_completion: 'form_completion',
    table_completion: 'table_completion',
    flow_chart_completion: 'flow_chart_completion',
    diagram_label_completion: 'diagram_label_completion',
    sentence_completion: 'sentence_completion',
    short_answer: 'short_answer',
    matching: 'matching',
    matching_headings: 'matching_headings',
    matching_features: 'matching_features',
    matching_sentence_endings: 'matching_sentence_endings',
    matching_info: 'matching_information',
    matching_information: 'matching_information',
    plan_map_diagram: 'plan_map_diagram',
    listening_map: 'listening_map',
    gap_fill: 'note_completion',
    // Common aliases from LLM output
    tfng: 'true_false_notgiven',
    t_f_ng: 'true_false_notgiven',
    ynng: 'yes_no_notgiven',
    y_n_ng: 'yes_no_notgiven',
    true_false_not_given: 'true_false_notgiven',
    yes_no_not_given: 'yes_no_notgiven',
    true_false_notgiven_questions: 'true_false_notgiven',
    yes_no_notgiven_questions: 'yes_no_notgiven',
    true_false_ng: 'true_false_notgiven',
    yes_no_ng: 'yes_no_notgiven',
    multiple_choice: 'mult_choice',
    multiple_choice_single: 'mult_choice',
    multiple_choice_multi: 'mult_choice',
    mcq: 'mult_choice',
    multiple_choices: 'mult_choice',
    matching_heading: 'matching_headings',
    matching_information_legacy: 'matching_information',
    matching_info_legacy: 'matching_information',
    matching_the_information: 'matching_information',
    sentence_completion_questions: 'sentence_completion',
    note_completions: 'note_completion',
    notes_completion: 'note_completion',
    summary_completions: 'summary_completion',
    diagram_labeling: 'diagram_label_completion',
    diagram_labelling: 'diagram_label_completion',
    flowchart_completion: 'flow_chart_completion',
    flowchart_completions: 'flow_chart_completion',
    flow_chart: 'flow_chart_completion',
    map_labeling_questions: 'plan_map_diagram',
    map_labeling: 'plan_map_diagram',
    map_labelling: 'plan_map_diagram',
    listening_map_labelling: 'listening_map',
    listening_map_labeling: 'listening_map',
};

const normalizeText = (value = '') => String(value ?? '').trim();

const normalizeTypeToken = (value = '') =>
    normalizeText(value)
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[\s\-\/]+/g, '_')
        .replace(/_+/g, '_');

const parsePositiveInt = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;

        const numeric = Number(trimmed);
        if (Number.isFinite(numeric)) {
            const int = Math.trunc(numeric);
            return int > 0 ? int : null;
        }

        const embedded = trimmed.match(/(\d+)/);
        if (embedded) {
            const extracted = Number(embedded[1]);
            if (Number.isFinite(extracted)) {
                const int = Math.trunc(extracted);
                return int > 0 ? int : null;
            }
        }
        return null;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const int = Math.trunc(numeric);
    return int > 0 ? int : null;
};

const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === '') return [];
    return [value];
};

const parseCorrectAnswers = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeText(item)).filter(Boolean);
    }
    const raw = normalizeText(value);
    if (!raw) return [];
    if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => normalizeText(item)).filter(Boolean);
            }
        } catch (_error) {
            // Fall through to token splitting.
        }
    }
    return raw
        .split(/[,\n;|]/g)
        .map((item) => normalizeText(item))
        .filter(Boolean);
};

const buildChoices = (value, defaultPrefix = 'A') => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.entries(value)
            .map(([key, text]) => {
                const normalizedText = normalizeText(text);
                if (!normalizedText) return null;
                return {
                    label: normalizeText(key) || defaultPrefix,
                    text: normalizedText,
                };
            })
            .filter(Boolean);
    }
    const rows = toArray(value);
    return rows
        .map((row, index) => {
            if (typeof row === 'string') {
                const text = normalizeText(row);
                if (!text) return null;
                return {
                    label: String.fromCharCode(defaultPrefix.charCodeAt(0) + index),
                    text,
                };
            }
            const text = normalizeText(row?.text || row?.value || row?.content || '');
            if (!text) return null;
            const label = normalizeText(row?.label || row?.id || '') || String.fromCharCode(defaultPrefix.charCodeAt(0) + index);
            return { label, text };
        })
        .filter(Boolean);
};

const buildIdTextRows = (value, fallbackPrefix = 'A') => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.entries(value)
            .map(([id, text]) => {
                const normalizedText = normalizeText(text);
                if (!normalizedText) return null;
                return {
                    id: normalizeText(id),
                    text: normalizedText,
                };
            })
            .filter(Boolean);
    }

    const rows = toArray(value);
    return rows
        .map((row, index) => {
            if (typeof row === 'string') {
                const text = normalizeText(row);
                if (!text) return null;
                return { id: `${fallbackPrefix}${index + 1}`, text };
            }
            const text = normalizeText(row?.text || row?.value || row?.content || '');
            if (!text) return null;
            const id = normalizeText(row?.id || row?.label || '') || `${fallbackPrefix}${index + 1}`;
            return { id, text };
        })
        .filter(Boolean);
};

const extractPlaceholderNumbers = (raw = '') => {
    const source = normalizeText(raw);
    if (!source) return [];
    const matches = [...source.matchAll(/\[(\d+)\]/g)];
    const unique = new Set(matches.map((match) => Number(match?.[1])).filter((num) => Number.isInteger(num) && num > 0));
    return [...unique].sort((a, b) => a - b);
};

const parseNumberedQuestionsFromText = (raw = '') => {
    const source = normalizeText(raw);
    if (!source) return [];
    const lines = source
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean);
    return lines
        .map((line) => {
            const match = line.match(/^(\d{1,3})[\).\:\-]\s+(.+)$/);
            if (!match) return null;
            return {
                q_number: Number(match[1]),
                text: normalizeText(match[2]),
            };
        })
        .filter(Boolean);
};

const normalizeGroupLayout = (value = '') => {
    const normalized = normalizeTypeToken(value);
    if (GROUP_LAYOUT_SET.has(normalized)) return normalized;
    return 'default';
};

const inferTypeFromShape = (group, isPassage) => {
    const questionRows = toArray(group?.questions);
    const answers = questionRows.flatMap((question) =>
        parseCorrectAnswers(question?.correct_answers || question?.correct_answer || question?.answer || '')
    );
    if (answers.some((answer) => ['TRUE', 'FALSE', 'NOT GIVEN'].includes(answer.toUpperCase()))) {
        return 'true_false_notgiven';
    }
    if (answers.some((answer) => ['YES', 'NO', 'NOT GIVEN'].includes(answer.toUpperCase()))) {
        return 'yes_no_notgiven';
    }

    const hasChoices = toArray(group?.questions).some((question) => toArray(question?.option).length > 0);
    if (hasChoices) return 'mult_choice';

    const hasHeadings = toArray(group?.headings).length > 0 || toArray(group?.right_options).length > 0;
    if (hasHeadings) {
        return isPassage ? 'matching_headings' : 'matching';
    }

    const hasOptions = toArray(group?.options).length > 0 || toArray(group?.left_items).length > 0;
    if (hasOptions) return 'summary_completion';

    if (extractPlaceholderNumbers(group?.text || '').length > 0) {
        return 'note_completion';
    }

    return 'mult_choice';
};

const canonicalizeQuestionType = (value, isPassage, fallbackGroup = null) => {
    const raw = normalizeTypeToken(value);
    const mapped = TYPE_ALIASES[raw] || raw;
    const allowed = new Set(isPassage ? PASSAGE_QUESTION_TYPES : SECTION_QUESTION_TYPES);
    if (allowed.has(mapped)) return mapped;

    const inferred = inferTypeFromShape(fallbackGroup, isPassage);
    if (allowed.has(inferred)) return inferred;

    return isPassage ? 'mult_choice' : 'mult_choice';
};

const normalizeQuestion = ({
    question,
    groupType,
    fallbackQNumber,
}) => {
    const normalizedQNumber = parsePositiveInt(
        question?.q_number
        ?? question?.qNumber
        ?? question?.number
        ?? question?.id
    );
    const qNumber = Number.isInteger(normalizedQNumber) && normalizedQNumber > 0
        ? normalizedQNumber
        : fallbackQNumber;

    const choiceOptions = buildChoices(
        question?.option
        || question?.options
        || question?.choices
        || question?.answer_options
        || []
    );
    const correctAnswers = parseCorrectAnswers(
        question?.correct_answers
        ?? question?.correct_answer
        ?? question?.answer
        ?? question?.answers
        ?? ''
    );
    const normalizedOptions = BOOLEAN_TYPES.has(groupType) && choiceOptions.length === 0
        ? BOOLEAN_OPTIONS_BY_TYPE[groupType].map((text, index) => ({
            label: String.fromCharCode(65 + index),
            text,
        }))
        : choiceOptions;

    return {
        q_number: qNumber,
        text: normalizeText(question?.text || question?.question || question?.prompt || question?.stem || ''),
        option: normalizedOptions,
        correct_answers: correctAnswers,
        explanation: normalizeText(question?.explanation || ''),
        passage_reference: normalizeText(question?.passage_reference || ''),
    };
};

const buildGroupAnswerRows = (group = {}) => {
    const rows = toArray(group?.answers || group?.answer_key || group?.answerKey || []);
    return rows
        .map((row, index) => {
            if (row === null || row === undefined || row === '') return null;
            if (typeof row === 'string' || typeof row === 'number') {
                const answers = parseCorrectAnswers(String(row));
                if (!answers.length) return null;
                return {
                    q_number: index + 1,
                    correct_answers: answers,
                    explanation: '',
                    passage_reference: '',
                    text: '',
                };
            }

            const qNumber = parsePositiveInt(row?.q_number ?? row?.qNumber ?? row?.id ?? row?.number);
            const answers = parseCorrectAnswers(
                row?.correct_answers
                ?? row?.correct_answer
                ?? row?.answer
                ?? row?.value
                ?? ''
            );

            return {
                q_number: qNumber,
                correct_answers: answers,
                explanation: normalizeText(row?.explanation || ''),
                passage_reference: normalizeText(row?.passage_reference || ''),
                text: normalizeText(row?.text || row?.question || ''),
            };
        })
        .filter(Boolean);
};

const mergeQuestionsWithGroupAnswers = (questions, answerRows, nextQNumberRef) => {
    if (!answerRows.length) return questions;

    const merged = [...questions];
    const indexByNumber = new Map(merged.map((question, index) => [question.q_number, index]));

    answerRows.forEach((answerRow) => {
        const normalizedNumber = answerRow.q_number || nextQNumberRef.current;
        const rowWithNumber = { ...answerRow, q_number: normalizedNumber };
        if (!answerRow.q_number) {
            nextQNumberRef.current += 1;
        }

        const existingIndex = indexByNumber.get(rowWithNumber.q_number);
        if (existingIndex !== undefined) {
            const existing = merged[existingIndex];
            merged[existingIndex] = {
                ...existing,
                text: existing.text || rowWithNumber.text || '',
                correct_answers: existing.correct_answers?.length ? existing.correct_answers : rowWithNumber.correct_answers,
                explanation: existing.explanation || rowWithNumber.explanation || '',
                passage_reference: existing.passage_reference || rowWithNumber.passage_reference || '',
            };
            return;
        }

        const nextQuestion = {
            q_number: rowWithNumber.q_number,
            text: rowWithNumber.text || '',
            option: [],
            correct_answers: rowWithNumber.correct_answers || [],
            explanation: rowWithNumber.explanation || '',
            passage_reference: rowWithNumber.passage_reference || '',
        };
        indexByNumber.set(nextQuestion.q_number, merged.length);
        merged.push(nextQuestion);
    });

    return merged;
};

const ensurePlaceholderQuestions = (questions, text, nextQNumberRef) => {
    const placeholderNumbers = extractPlaceholderNumbers(text);
    if (!placeholderNumbers.length) return questions;

    const indexByNumber = new Map(questions.map((question, index) => [question.q_number, index]));
    const nextQuestions = [...questions];

    placeholderNumbers.forEach((qNumber) => {
        if (indexByNumber.has(qNumber)) return;
        nextQuestions.push({
            q_number: qNumber,
            text: '',
            option: [],
            correct_answers: [],
            explanation: '',
            passage_reference: '',
        });
    });

    const maxPlaceholder = Math.max(...placeholderNumbers);
    nextQNumberRef.current = Math.max(nextQNumberRef.current, maxPlaceholder + 1);
    return nextQuestions;
};

const normalizeQuestionGroup = ({
    group,
    isPassage,
    nextQNumberRef,
}) => {
    const type = canonicalizeQuestionType(group?.type, isPassage, group);
    const groupLayout = normalizeGroupLayout(group?.group_layout || group?.groupLayout || group?.layout || 'default');
    const requiredCount = parsePositiveInt(group?.required_count ?? group?.requiredCount);
    const useOnce = Boolean(group?.use_once ?? group?.useOnce);
    const instructions = normalizeText(group?.instructions || '');
    const text = normalizeText(group?.text || group?.passage || group?.template || '');
    const headings = buildIdTextRows(
        group?.headings
        || group?.right_options
        || group?.rightOptions
        || [],
        'H'
    );
    const options = buildIdTextRows(
        group?.options
        || group?.word_list
        || group?.wordList
        || group?.right_options
        || [],
        'O'
    );

    let questions = toArray(group?.questions).map((question) => {
        const normalized = normalizeQuestion({
            question,
            groupType: type,
            fallbackQNumber: nextQNumberRef.current,
        });
        nextQNumberRef.current = Math.max(nextQNumberRef.current, normalized.q_number + 1);
        return normalized;
    });

    if (questions.length === 0) {
        const leftItems = buildIdTextRows(group?.left_items || group?.leftItems || [], 'L');
        if (leftItems.length > 0) {
            questions = leftItems.map((item) => {
                const parsed = parsePositiveInt(item.id);
                const qNumber = parsed || nextQNumberRef.current;
                if (!parsed) nextQNumberRef.current += 1;
                nextQNumberRef.current = Math.max(nextQNumberRef.current, qNumber + 1);
                return {
                    q_number: qNumber,
                    text: item.text,
                    option: [],
                    correct_answers: [],
                    explanation: '',
                    passage_reference: '',
                };
            });
        }
    }

    const groupAnswers = buildGroupAnswerRows(group);
    questions = mergeQuestionsWithGroupAnswers(questions, groupAnswers, nextQNumberRef);

    if (COMPLETION_TYPES.has(type)) {
        questions = ensurePlaceholderQuestions(questions, text, nextQNumberRef);
    }

    if (questions.length === 0 && COMPLETION_TYPES.has(type)) {
        const placeholderNumbers = extractPlaceholderNumbers(text);
        questions = placeholderNumbers.map((qNumber) => ({
            q_number: qNumber,
            text: '',
            option: [],
            correct_answers: [],
            explanation: '',
            passage_reference: '',
        }));
        const maxPlaceholder = Math.max(...placeholderNumbers, 0);
        nextQNumberRef.current = Math.max(nextQNumberRef.current, maxPlaceholder + 1);
    }

    const normalizedHeadings = MATCHING_TYPES.has(type)
        ? (headings.length > 0 ? headings : options)
        : headings;

    const normalizedOptions = (
        type === 'summary_completion'
        || type === 'plan_map_diagram'
        || type === 'listening_map'
    )
        ? (options.length > 0 ? options : normalizedHeadings)
        : options;

    questions = questions.map((question) => ({
        ...question,
        option: toArray(question.option).filter((choice) => normalizeText(choice?.text || '')),
    }))
        .sort((left, right) => left.q_number - right.q_number);

    return {
        type,
        group_layout: groupLayout,
        ...(requiredCount ? { required_count: requiredCount } : {}),
        ...(useOnce ? { use_once: true } : {}),
        instructions,
        text,
        headings: normalizedHeadings,
        options: normalizedOptions,
        questions,
    };
};

const unwrapModelPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return {};
    if (Array.isArray(payload)) return payload[0] || {};
    if (payload.data && typeof payload.data === 'object') return payload.data;
    if (payload.result && typeof payload.result === 'object') return payload.result;
    return payload;
};

const buildRawGroupCandidatesFromSource = (source = {}) => {
    const directGroups = toArray(source?.question_groups || source?.questionGroups || source?.groups);
    if (directGroups.length > 0) return directGroups;

    const rootQuestions = toArray(source?.questions);
    if (rootQuestions.length === 0) return [];

    return [{
        type: source?.type || source?.question_type || '',
        instructions: source?.instructions || '',
        text: source?.text || '',
        headings: source?.headings || source?.right_options || [],
        options: source?.options || source?.word_list || [],
        questions: rootQuestions,
        answers: source?.answers || [],
    }];
};

const buildFallbackGroupsFromRawText = ({ rawText = '', isPassage }) => {
    const numberedQuestions = parseNumberedQuestionsFromText(rawText);
    if (numberedQuestions.length > 0) {
        return [{
            type: 'mult_choice',
            instructions: '',
            text: '',
            headings: [],
            options: [],
            questions: numberedQuestions.map((question) => ({
                q_number: question.q_number,
                text: question.text,
                option: [],
                correct_answers: [],
                explanation: '',
                passage_reference: '',
            })),
        }];
    }

    const placeholders = extractPlaceholderNumbers(rawText);
    if (placeholders.length > 0) {
        return [{
            type: isPassage ? 'note_completion' : 'form_completion',
            instructions: '',
            text: normalizeText(rawText),
            headings: [],
            options: [],
            questions: placeholders.map((qNumber) => ({
                q_number: qNumber,
                text: '',
                option: [],
                correct_answers: [],
                explanation: '',
                passage_reference: '',
            })),
        }];
    }

    return [];
};

const normalizeGeneratedContent = ({
    parsed = {},
    rawText = '',
    type = 'passage',
}) => {
    const isPassage = type === 'passage';
    const source = unwrapModelPayload(parsed);
    const nextQNumberRef = { current: 1 };
    const rawGroupCandidates = buildRawGroupCandidatesFromSource(source);
    let questionGroups = rawGroupCandidates.map((group) =>
        normalizeQuestionGroup({
            group,
            isPassage,
            nextQNumberRef,
        })
    );
    questionGroups = questionGroups.filter((group) =>
        group.questions.length > 0
        || normalizeText(group.text)
        || group.headings.length > 0
        || group.options.length > 0
    );

    if (questionGroups.length === 0) {
        questionGroups = buildFallbackGroupsFromRawText({ rawText, isPassage }).map((group) =>
            normalizeQuestionGroup({
                group,
                isPassage,
                nextQNumberRef,
            })
        );
    }

    const normalized = {
        title: normalizeText(source?.title) || (isPassage ? 'Generated Reading Passage' : 'Generated Listening Section'),
        content: normalizeText(source?.content || source?.passage || source?.transcript) || normalizeText(rawText) || 'To be added',
        source: normalizeText(source?.source) || 'AI Generated',
        question_groups: questionGroups,
    };

    if (!isPassage) {
        normalized.audio_url = normalizeText(source?.audio_url || source?.audioUrl || '');
    }

    return normalized;
};

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

    const systemPrompt = `
You are an IELTS content parser for admin authoring tools.
Convert raw text/images into EXACTLY one JSON object for an IELTS ${isPassage ? 'Reading Passage' : 'Listening Section'}.
Return strict JSON only (no markdown, no comments, no prose).

Allowed question group "type" values:
${enumListText}

Required output shape:
{
  "title": "string",
  "content": "string",
  ${!isPassage ? '"audio_url": "string",' : ''}
  "source": "string",
  "question_groups": [
    {
      "type": "string",
      "group_layout": "default|two_column|with_reference|radio|checkbox",
      "required_count": 2,
      "use_once": false,
      "instructions": "string",
      "text": "string",
      "headings": [{ "id": "string", "text": "string" }],
      "options": [{ "id": "string", "text": "string" }],
      "questions": [
        {
          "q_number": 1,
          "text": "string",
          "option": [{ "label": "A", "text": "string" }],
          "correct_answers": ["string"],
          "explanation": "",
          "passage_reference": ""
        }
      ]
    }
  ]
}

Parsing rules:
1) Always return "question_groups" as an array (can be empty only if no questions exist in source).
2) Use only allowed "type" enum values.
3) Preserve original question numbering and grouping by instruction blocks.
4) Multiple choice:
   - Include option labels A/B/C/... in each question.option.
   - Store correct_answers as option labels (example: ["B"] or ["A","C"]).
5) TFNG and YNNG:
   - Do not invent custom options.
   - Use correct_answers with exact canonical values:
     TFNG => TRUE/FALSE/NOT GIVEN
     YNNG => YES/NO/NOT GIVEN
6) Matching:
   - Put shared candidates into headings[].
   - Put each sub-question in questions[].
   - correct_answers stores selected heading id/label.
7) Completion types (summary/note/table/flow/diagram/form/sentence):
   - Put template text with placeholders in group.text (example [1], [2], ...).
   - Create one question per placeholder with matching q_number.
8) If answers are missing, set correct_answers to [].
9) "content" should be the main passage/transcript body, not the question list.
10) If content is truly unavailable, set "content" to "To be added".
`;

    const messages = [
        { role: "system", content: systemPrompt },
        { 
            role: "user", 
            content: [
                { type: "text", text: rawText || `Parse the attached image(s) into the required IELTS ${isPassage ? 'reading passage' : 'listening section'} JSON structure.` },
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
                temperature: 0.2,
                response_format: { type: "json_object" }
            }),
            timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 45000),
            maxAttempts: Number(process.env.OPENAI_MAX_ATTEMPTS || 3),
        });

        return normalizeGeneratedContent({
            parsed: aiResult.data,
            rawText,
            type,
        });
    } catch (error) {
        console.error("Content Gen Error:", error);
        return normalizeGeneratedContent({
            parsed: {
                title: "AI parsing unavailable",
                content: rawText || "",
                source: "fallback",
                question_groups: [],
            },
            rawText,
            type,
        });
    }
};
