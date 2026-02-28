import OpenAI from 'openai';
import { requestOpenAIJsonWithFallback } from '../utils/aiClient.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const hasOpenAiCredentials = Boolean(OPENAI_API_KEY);

const OPENAI_MODELS = [
  process.env.OPENAI_PRIMARY_MODEL || "gpt-4o",
  process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini",
];

const DETAIL_AUGMENT_MODELS = [
  process.env.OPENAI_DETAIL_AUGMENT_MODEL || "gpt-4o-mini",
  process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini",
].filter(Boolean);

const countWords = (text = "") =>
  String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const getDetailErrorTargets = (taskType = "task2", essayText = "") => {
  const words = countWords(essayText);

  if (taskType === "task1") {
    if (words >= 190) return { gra: 12, lexical: 10 };
    if (words >= 160) return { gra: 10, lexical: 8 };
    if (words >= 130) return { gra: 8, lexical: 6 };
    return { gra: 6, lexical: 5 };
  }

  if (words >= 280) return { gra: 24, lexical: 20 };
  if (words >= 240) return { gra: 20, lexical: 16 };
  if (words >= 200) return { gra: 18, lexical: 14 };
  if (words >= 160) return { gra: 14, lexical: 11 };
  return { gra: 10, lexical: 8 };
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const isErrorIssue = (issue) => String(issue?.type || "error").toLowerCase() === "error";

const countErrorIssues = (items) => toArray(items).filter(isErrorIssue).length;

const issueIdentity = (issue = {}) => [
  String(issue?.error_code || "").trim().toLowerCase(),
  String(issue?.text_snippet || "").trim().toLowerCase(),
  String(issue?.improved || "").trim().toLowerCase(),
  String(issue?.explanation || "").trim().toLowerCase(),
].join("::");

const dedupeIssues = (items) => {
  const seen = new Set();
  const output = [];

  for (const item of toArray(items)) {
    const key = issueIdentity(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
};

const ensureDetailResultArrays = (result = {}) => ({
  ...result,
  task_response: toArray(result?.task_response),
  coherence_cohesion: toArray(result?.coherence_cohesion),
  lexical_resource: toArray(result?.lexical_resource),
  grammatical_range_accuracy: toArray(result?.grammatical_range_accuracy),
});

const maybeAugmentGrammarAndLexicalIssues = async ({
  promptText,
  essayText,
  taskType = "task2",
  baseResult,
  targets,
}) => {
  const normalized = ensureDetailResultArrays(baseResult || {});
  const graCount = countErrorIssues(normalized.grammatical_range_accuracy);
  const lexicalCount = countErrorIssues(normalized.lexical_resource);

  if (graCount >= targets.gra && lexicalCount >= targets.lexical) {
    return normalized;
  }

  const existingGraSnippets = normalized.grammatical_range_accuracy
    .map((item) => String(item?.text_snippet || "").trim())
    .filter(Boolean)
    .slice(0, 120);

  const existingLexicalSnippets = normalized.lexical_resource
    .map((item) => String(item?.text_snippet || "").trim())
    .filter(Boolean)
    .slice(0, 120);

  const grammarCodes = taskType === "task1"
    ? "W1-G1, W1-G2, W1-G3, W1-G4"
    : "W2-G1, W2-G2, W2-G3";
  const lexicalCodes = taskType === "task1"
    ? "W1-L1, W1-L2, W1-L3"
    : "W2-L1, W2-L2, W2-L3";

  const augmentPrompt = `
You are a strict IELTS writing error extractor.
Return ONLY additional issues that are missing, in valid JSON.

Task type: ${taskType}
Prompt:
${String(promptText || "").trim()}

Student essay:
${String(essayText || "").trim()}

Current issue counts:
- grammatical_range_accuracy: ${graCount}
- lexical_resource: ${lexicalCount}

Minimum required after augmentation:
- grammatical_range_accuracy >= ${targets.gra}
- lexical_resource >= ${targets.lexical}

Hard rules:
- Do not duplicate existing snippets.
- One issue = one error only.
- Prioritize grammatical accuracy gaps and spelling/word-form/collocation mistakes.
- If many misspelled words exist, list them separately (one misspelled token per item).
- For lexical suggestions, prioritize A2/B1 -> B2/C1 replacements when appropriate.
- Use grammar codes only from: ${grammarCodes}
- Use lexical codes only from: ${lexicalCodes}
- Keep "type" as "error" for detected mistakes.

Existing GRA snippets (do not duplicate):
${JSON.stringify(existingGraSnippets)}

Existing LR snippets (do not duplicate):
${JSON.stringify(existingLexicalSnippets)}

Return JSON:
{
  "grammatical_range_accuracy": [
    {
      "text_snippet": "string",
      "type": "error",
      "error_code": "string",
      "explanation": "string (Vietnamese)",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "lexical_resource": [
    {
      "text_snippet": "string",
      "type": "error",
      "error_code": "string",
      "explanation": "string (Vietnamese)",
      "improved": "string",
      "lexical_unit": "word|collocation",
      "source_level": "A2|B1|B2|C1|C2|UNKNOWN",
      "target_level": "B2|C1|C2|UNKNOWN",
      "b2_replacement": "string",
      "c1_replacement": "string",
      "band6_replacement": "string",
      "band65_replacement": "string",
      "band_impact": "string"
    }
  ]
}
`;

  try {
    const augmentResponse = await requestOpenAIJsonWithFallback({
      openai,
      models: DETAIL_AUGMENT_MODELS,
      createPayload: (model) => ({
        model,
        messages: [{ role: "user", content: augmentPrompt }],
        max_tokens: 2800,
        response_format: { type: "json_object" },
      }),
      timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 60000),
      maxAttempts: 2,
    });

    const extra = augmentResponse?.data || {};
    const mergedGra = dedupeIssues([
      ...normalized.grammatical_range_accuracy,
      ...toArray(extra.grammatical_range_accuracy),
    ]);
    const mergedLexical = dedupeIssues([
      ...normalized.lexical_resource,
      ...toArray(extra.lexical_resource),
    ]);

    return {
      ...normalized,
      grammatical_range_accuracy: mergedGra,
      lexical_resource: mergedLexical,
    };
  } catch (augmentError) {
    console.error("gradeEssay augmentation skipped:", augmentError.message);
    return normalized;
  }
};

export const gradeEssay = async (promptText, essayText, taskType = 'task2', imageUrl = null) => {
  let systemPrompt = '';
  let userMessageContent = [];
  const detailTargets = getDetailErrorTargets(taskType, essayText);

  if (taskType === 'task1') {
    systemPrompt = `Hãy đóng vai một giám khảo IELTS Writing Task 1 (Band 8.0+), có ít nhất 10 năm kinh nghiệm,
và chấm theo Band Descriptors chính thức của IELTS.

ĐỀ BÀI (Topic):
${promptText}

BÀI VIẾT CỦA HỌC SINH (Student Essay):
${essayText}

Bạn phải phân tích bài viết theo 4 tiêu chí IELTS Writing Task 1:
1) Task Achievement (TA) - thay cho Task Response
2) Coherence & Cohesion (CC)
3) Lexical Resource (LR)
4) Grammatical Range & Accuracy (GRA)

━━━━━━━━━━━━━━━━━━━━━━
YÊU CẦU RẤT QUAN TRỌNG (BẮT BUỘC)
━━━━━━━━━━━━━━━━━━━━━━

A) Mỗi tiêu chí phải trả về là MỘT ARRAY riêng.
B) Mỗi tiêu chí phải cố gắng tìm ÍT NHẤT 5-7 lỗi/điểm cần cải thiện.
   - Nếu không đủ lỗi, hãy đưa ra gợi ý nâng cao (suggestion).
   - Với Grammatical Range & Accuracy, ưu tiên ít nhất ${detailTargets.gra} mục lỗi khi bài có đủ dữ liệu.
C) SOI KỸ Task Achievement (TA):
   - Bài viết có overview rõ ràng không?
   - Có highlight key features không?
   - Số liệu có chính xác so với biểu đồ không (nếu có)?
D) Với Lexical Resource (LR):
   - Ưu tiên chọn từ/cụm từ (word hoặc collocation) đang ở mức A2-B1 trong bài.
   - Đưa ra nâng cấp đúng ngữ cảnh theo đích B2/C1:
     + "b2_replacement": từ/cụm thay thế mức B2
     + "c1_replacement": từ/cụm thay thế mức C1
   - Đồng thời giữ "band6_replacement"/"band65_replacement" để tương thích hệ thống cũ.
   - Phải bắt lỗi chính tả (spelling), word form, collocation sai; mỗi lỗi chính tả là một item riêng.
E) KHÔNG trộn tiêu chí.
   - Task Achievement: nói về việc tóm tắt, so sánh, không đưa ý kiến cá nhân.
F) Mỗi mục phải:
   - text_snippet: trích dẫn
   - explanation: giải thích tiếng Việt
   - improved: sửa lại
   - band_impact: ảnh hưởng điểm số
G) BẮT BUỘC: Mỗi lỗi phải gán một "error_code" chính xác từ danh sách Error Taxonomy sau:
   - [Task Achievement] W1-T1 Missing Overview, W1-T2 No Key Feature, W1-T3 Wrong Data Comparison, W1-T4 Over-Detail
   - [Grammar] W1-G1 Tense Error, W1-G2 Comparison Structure Error, W1-G3 Preposition Error, W1-G4 Agreement Error
   - [Lexical] W1-L1 Repetition, W1-L2 Informal Vocabulary, W1-L3 Collocation Error
   - [Coherence] W1-C1 Thiếu liên kết câu, W1-C2 Dùng sai từ nối, W1-C3 Lặp lại cấu trúc liên kết, W1-C4 Chia đoạn sai
   - Nếu là mục "good" hoặc "suggestion" không có lỗi sai cụ thể, hãy dùng mã: "NONE"

━━━━━━━━━━━━━━━━━━━━━━
OUTPUT: CHỈ TRẢ JSON HỢP LỆ
━━━━━━━━━━━━━━━━━━━━━━
Lưu ý: Vẫn dùng key "task_response" trong JSON để chứa nội dung "Task Achievement" nhằm tương thích hệ thống.

{
  "band_score": number,
  "criteria_scores": {
    "task_response": number, // Điểm Task Achievement
    "coherence_cohesion": number,
    "lexical_resource": number,
    "grammatical_range_accuracy": number
  },
  "task_response": [
    {
      "text_snippet": "string",
      "type": "error|good|suggestion",
      "error_code": "string",
      "explanation": "string",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "coherence_cohesion": [
    {
      "text_snippet": "string",
      "type": "error|good|suggestion",
      "error_code": "string",
      "explanation": "string",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "lexical_resource": [
    {
      "text_snippet": "string",
      "type": "error|good|suggestion",
      "error_code": "string",
      "explanation": "string",
      "improved": "string",
      "lexical_unit": "word|collocation",
      "source_level": "A2|B1|B2|C1|C2|UNKNOWN",
      "target_level": "B2|C1|C2|UNKNOWN",
      "b2_replacement": "string",
      "c1_replacement": "string",
      "band6_replacement": "string",
      "band65_replacement": "string",
      "band_impact": "string"
    }
  ],
  "grammatical_range_accuracy": [
    {
      "text_snippet": "string",
      "type": "error|good|suggestion",
      "error_code": "string",
      "explanation": "string",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "feedback": [ "string (Nhận xét tổng quan Task 1)" ],
  "sample_essay": "string (Viết bài mẫu Band 8.0 cho Task 1 này)"
}
`;
    // Prepare message content for Task 1 (potentially with image)
    userMessageContent.push({ type: "text", text: systemPrompt });
    if (imageUrl) {
      userMessageContent.push({
        type: "image_url",
        image_url: {
          "url": imageUrl,
        },
      });
    }

  } else {
    // DEFAULT: TASK 2 Logic
    systemPrompt = `Hãy đóng vai một giám khảo IELTS Writing Task 2 (Band 8.0+), có ít nhất 10 năm kinh nghiệm,
và chấm theo Band Descriptors chính thức của IELTS.

ĐỀ BÀI (Topic):
${promptText}

BÀI VIẾT CỦA HỌC SINH (Student Essay):
${essayText}

Bạn phải phân tích bài viết theo 4 tiêu chí IELTS:
1) Task Response (TR)
2) Coherence & Cohesion (CC)
3) Lexical Resource (LR)
4) Grammatical Range & Accuracy (GRA)

Task Response (TR)

What it checks:
Did you fully answer all parts of the question?
Is your position clear throughout?
Are ideas developed and supported?

High Band (7–9):
Fully addresses all parts of the task
Clear, consistent position
Ideas are well-developed and extended with relevant examples

Mid Band (5–6):
Addresses the task but may miss some parts
Position is present but may be unclear at times
Ideas are relevant but not fully developed

Low Band (4 and below):
Partially addresses the task
Position unclear or inconsistent
Ideas lack development or support

2️⃣ Coherence and Cohesion (CC)

What it checks:
Logical organization of ideas
Clear paragraphing
Appropriate use of linking words
Clear referencing

High Band (7–9):
Ideas logically organized
Clear progression throughout
Skillful use of cohesive devices
Clear paragraph structure

Mid Band (5–6):
Generally organized
Some problems with linking or repetition
Paragraphing may be inconsistent

Low Band (4 and below):
Difficult to follow
Poor organization
Overuse or misuse of linking words

3️⃣ Lexical Resource (LR)

What it checks:
Vocabulary range
Accuracy
Collocations
Spelling

High Band (7–9):
Wide range of vocabulary
Precise word choice
Natural collocations
Rare minor errors

Mid Band (5–6):
Adequate vocabulary for the task
Some repetition
Noticeable word choice errors

Low Band (4 and below):
Limited vocabulary
Frequent errors
Meaning may be unclear

4️⃣ Grammatical Range and Accuracy (GRA)

What it checks:
Variety of sentence structures
Accuracy of grammar
Punctuation

High Band (7–9):
Wide range of complex structures
Majority error-free sentences 
Good control of punctuation

Mid Band (5–6):
Mix of simple and complex sentences
Frequent grammatical errors
Errors may reduce clarity

Low Band (4 and below):
Mostly simple sentences
Frequent errors
Hard to understand

━━━━━━━━━━━━━━━━━━━━━━
YÊU CẦU RẤT QUAN TRỌNG (BẮT BUỘC)
━━━━━━━━━━━━━━━━━━━━━━

A) Mỗi tiêu chí phải trả về là MỘT ARRAY riêng (không lồng trong object issues).
B) Mỗi tiêu chí phải cố gắng tìm ÍT NHẤT 10 lỗi/điểm cần cải thiện.
   - Nếu một tiêu chí không đủ 10 mục, bắt buộc ghi rõ lý do trong explanation.
   - Với GRA cần đạt tối thiểu ${detailTargets.gra} lỗi nếu bài có đủ dữ liệu.
   - Với LR cần đạt tối thiểu ${detailTargets.lexical} lỗi nếu bài có đủ dữ liệu.
C) SOI KỸ NHẤT tiêu chí GRA: 
   - Ưu tiên phát hiện lỗi ngữ pháp cơ bản + lỗi lặp lại + lỗi gây khó hiểu.
   - Cố gắng tách lỗi nhỏ thành từng mục (ví dụ: 1 câu có 3 lỗi → tách 3 mục).
   - Không bỏ sót lỗi chia động từ, mạo từ, giới từ, dấu câu, và lỗi chính tả của từ chức năng nếu làm sai ngữ pháp.
D) Với Lexical Resource (LR):
   - Mỗi mục lỗi từ vựng/collocation phải đưa:
          + "source_level": nhận diện trình độ CEFR của từ/cụm gốc (ưu tiên A2/B1)
     + "target_level": CEFR của gợi ý (ưu tiên B2/C1)
     + "lexical_unit": "word" hoặc "collocation"
     + "b2_replacement": từ/cụm thay thế phù hợp mức B2
     + "c1_replacement": từ/cụm thay thế phù hợp mức C1
     + "band6_replacement": từ/cụm thay thế phù hợp khoảng Band 6.0
     + "band65_replacement": từ/cụm thay thế phù hợp khoảng Band 6.5
   - Prioritize upgrading A2/B1 words or collocations to B2/C1 when context allows.
   - Only suggest replacements that preserve the original meaning in context.
   - Bắt buộc liệt kê lỗi chính tả/word form/collocation sai thành từng item riêng, không gộp nhiều lỗi vào một dòng.

E) KHÔNG trộn tiêu chí:
   - Task Response: chỉ nói về trả lời đề, lập trường, phát triển ý (không sửa grammar).
   - CC: chỉ nói về bố cục, liên kết, logic đoạn.
   - LR: chỉ nói từ vựng, collocation, lặp từ, formality.
   - GRA: chỉ nói ngữ pháp, thì, mạo từ, giới từ, cấu trúc câu, dấu câu.
F) Mỗi mục phải:
   - chỉ đúng 1 lỗi, không gộp nhiều lỗi vào 1 mục
   - trích đúng từ/cụm/câu gốc (text_snippet)
   - có improved (phiên bản sửa)
   - có explanation ngắn gọn tiếng Việt (1–2 câu)
   - có band_impact (ví dụ: "Reduces GRA to 5.0")
G) BẮT BUỘC: Mỗi lỗi phải gán một "error_code" chính xác từ danh sách Error Taxonomy sau:
   - [Task Response] W2-T1 Not Answering Question, W2-T2 Missing Position, W2-T3 Weak Argument, W2-T4 Off-topic
   - [Coherence] W2-C1 Poor Paragraphing, W2-C2 Weak Linking, W2-C3 Idea Jump
   - [Grammar] W2-G1 Complex Sentence Error, W2-G2 Fragment Sentence, W2-G3 Run-on Sentence
   - [Lexical] W2-L1 Word Choice Inaccuracy, W2-L2 Collocation Error, W2-L3 Overgeneralization
   - Nếu là mục "good" hoặc "suggestion" không có lỗi sai cụ thể, hãy dùng mã: "NONE"

━━━━━━━━━━━━━━━━━━━━━━
QUY TẮC ƯỚC LƯỢNG BAND
━━━━━━━━━━━━━━━━━━━━━━
- Lỗi cơ bản nhiều và lặp lại → Band 4.5–5.0
- Còn lỗi nhưng dễ hiểu → Band 6.0–6.5
- Lỗi nhỏ, ít → Band 7.0+
- Chấm nghiêm như giám khảo thật.

━━━━━━━━━━━━━━━━━━━━━━
OUTPUT: CHỈ TRẢ JSON HỢP LỆ
━━━━━━━━━━━━━━━━━━━━━━

{
  "band_score": number,
  "criteria_scores": {
    "task_response": number,
    "coherence_cohesion": number,
    "lexical_resource": number,
    "grammatical_range_accuracy": number
  },
  "task_response": [
    {
      "text_snippet": "string",
      "type": "error|good|suggestion",
      "error_code": "string",
      "explanation": "string (Vietnamese)",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "coherence_cohesion": [
    {
      "text_snippet": "string",
      "type": "error|good|suggestion",
      "error_code": "string",
      "explanation": "string (Vietnamese)",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "lexical_resource": [
    {
      "text_snippet": "string",
      "type": "error|good|suggestion",
      "error_code": "string",
      "explanation": "string (Vietnamese)",
      "improved": "string",
      "lexical_unit": "word|collocation",
      "source_level": "A2|B1|B2|C1|C2|UNKNOWN",
      "target_level": "B2|C1|C2|UNKNOWN",
      "b2_replacement": "string",
      "c1_replacement": "string",
      "band6_replacement": "string",
      "band65_replacement": "string",
      "band_impact": "string"
    }
  ],
  "grammatical_range_accuracy": [
    {
      "text_snippet": "string",
      "type": "error|good|suggestion",
      "error_code": "string",
      "explanation": "string (Vietnamese)",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "feedback": [
    "string (Nhận xét tổng quan bằng tiếng Việt, 7-10 câu)"
  ],
  "sample_essay": "string (Viết một bài mẫu Band 8.0 hoàn chỉnh theo đề bài ${promptText})"
}
`;
    userMessageContent.push({ type: "text", text: systemPrompt });
  }

  try {
    if (!hasOpenAiCredentials) {
      throw new Error("OpenAI API key is not configured");
    }
    const aiResult = await requestOpenAIJsonWithFallback({
      openai,
      models: OPENAI_MODELS,
      createPayload: (model) => ({
        model,
        messages: [{ role: "user", content: userMessageContent.length > 0 ? userMessageContent : systemPrompt }],
        max_tokens: 10000,
        response_format: { type: "json_object" },
      }),
      timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 60000),
      maxAttempts: Number(process.env.OPENAI_MAX_ATTEMPTS || 3),
    });
    const normalizedBase = ensureDetailResultArrays(aiResult.data || {});
    const enriched = await maybeAugmentGrammarAndLexicalIssues({
      promptText,
      essayText,
      taskType,
      baseResult: normalizedBase,
      targets: detailTargets,
    });
    return enriched;
  } catch (error) {
    console.error("gradeEssay AI fallback triggered:", error.message);
    return {
      band_score: 0,
      criteria_scores: {
        task_response: 0,
        coherence_cohesion: 0,
        lexical_resource: 0,
        grammatical_range_accuracy: 0
      },
      task_response: [],
      coherence_cohesion: [],
      lexical_resource: [],
      grammatical_range_accuracy: [],
      feedback: ["He thong tam thoi khong cham duoc bai viet. Vui long thu lai sau."],
      sample_essay: ""
    };
  }
};

const FAST_WRITING_MODELS = [
  process.env.WRITING_FAST_MODEL || "gpt-4o-mini",
  process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini",
  process.env.OPENAI_PRIMARY_MODEL || "gpt-4o",
].filter(Boolean);

const toBandHalfStep = (value, fallback = 0) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  const clamped = Math.min(9, Math.max(0, numberValue));
  return Math.round(clamped * 2) / 2;
};

const normalizeCriteriaScores = (rawScores = {}, fallbackBand = 0) => {
  const safeBand = toBandHalfStep(fallbackBand, 0);
  return {
    task_response: toBandHalfStep(rawScores.task_response, safeBand),
    coherence_cohesion: toBandHalfStep(rawScores.coherence_cohesion, safeBand),
    lexical_resource: toBandHalfStep(rawScores.lexical_resource, safeBand),
    grammatical_range_accuracy: toBandHalfStep(rawScores.grammatical_range_accuracy, safeBand),
  };
};

const normalizeCriteriaNotes = (rawNotes = {}) => ({
  task_response: String(rawNotes.task_response || "").trim(),
  coherence_cohesion: String(rawNotes.coherence_cohesion || "").trim(),
  lexical_resource: String(rawNotes.lexical_resource || "").trim(),
  grammatical_range_accuracy: String(rawNotes.grammatical_range_accuracy || "").trim(),
});

const toPerformanceLabel = (bandScore) => {
  const score = Number(bandScore || 0);
  if (score >= 7) return "Strong";
  if (score >= 6) return "Developing";
  return "Needs Improvement";
};

const normalizeFastTopIssues = (rawTopIssues = {}) => {
  const toIssueArray = (items = []) =>
    (Array.isArray(items) ? items : [])
      .map((item) => ({
        text_snippet: String(item?.text_snippet || "").trim(),
        explanation: String(item?.explanation || "").trim(),
        improved: String(item?.improved || "").trim(),
        error_code: String(item?.error_code || "NONE").trim() || "NONE",
      }))
      .filter((item) => item.text_snippet)
      .slice(0, 5);

  return {
    grammatical_range_accuracy: toIssueArray(rawTopIssues?.grammatical_range_accuracy || []),
    lexical_resource: toIssueArray(rawTopIssues?.lexical_resource || []),
  };
};

const normalizeFastEssayResult = (raw = {}, fallbackModel = null) => {
  const rawCriteria = normalizeCriteriaScores(raw.criteria_scores || {}, raw.band_score || 0);
  const criteriaAvg = (
    rawCriteria.task_response +
    rawCriteria.coherence_cohesion +
    rawCriteria.lexical_resource +
    rawCriteria.grammatical_range_accuracy
  ) / 4;

  const bandScore = toBandHalfStep(raw.band_score, toBandHalfStep(criteriaAvg, 0));
  const summary = String(raw.summary || "").trim();
  const normalized = {
    band_score: bandScore,
    criteria_scores: rawCriteria,
    summary,
    criteria_notes: normalizeCriteriaNotes(raw.criteria_notes || {}),
    top_issues: normalizeFastTopIssues(raw.top_issues || {}),
    performance_label: String(raw.performance_label || "").trim() || toPerformanceLabel(bandScore),
    feedback: Array.isArray(raw.feedback)
      ? raw.feedback.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
      : [],
    model: fallbackModel || null,
  };

  if (normalized.feedback.length === 0 && summary) {
    normalized.feedback = [summary];
  }

  return normalized;
};

export const gradeEssayFast = async (promptText, essayText, taskType = 'task2', imageUrl = null) => {
  const trimmedPrompt = String(promptText || "").trim();
  const trimmedEssay = String(essayText || "").trim();

  if (!trimmedEssay) {
    return normalizeFastEssayResult({
      band_score: 0,
      criteria_scores: {
        task_response: 0,
        coherence_cohesion: 0,
        lexical_resource: 0,
        grammatical_range_accuracy: 0,
      },
      summary: "Essay content is empty.",
      criteria_notes: {
        task_response: "No response content found.",
        coherence_cohesion: "No response content found.",
        lexical_resource: "No response content found.",
        grammatical_range_accuracy: "No response content found.",
      },
      top_issues: {
        grammatical_range_accuracy: [],
        lexical_resource: [],
      },
      performance_label: "Needs Improvement",
      feedback: ["Essay content is empty."],
    }, process.env.WRITING_FAST_MODEL || "gpt-4o-mini");
  }

  const taskLabel = taskType === "task1" ? "IELTS Writing Task 1" : "IELTS Writing Task 2";
  const fastPrompt = `
You are an IELTS writing examiner. Provide a quick, low-token estimate only.

Task Type: ${taskLabel}
Prompt:
${trimmedPrompt}

Student Essay:
${trimmedEssay}

Rules:
- Return compact JSON only.
- Scores must be in 0.5 band steps from 0 to 9.
- Keep feedback concise (fast estimate, not full diagnosis).
- For Task 1, use task_response key to represent Task Achievement.

Required JSON schema:
{
  "band_score": number,
  "criteria_scores": {
    "task_response": number,
    "coherence_cohesion": number,
    "lexical_resource": number,
    "grammatical_range_accuracy": number
  },
  "summary": "string (2-4 sentences)",
  "criteria_notes": {
    "task_response": "string",
    "coherence_cohesion": "string",
    "lexical_resource": "string",
    "grammatical_range_accuracy": "string"
  },
  "top_issues": {
    "grammatical_range_accuracy": [
      {
        "text_snippet": "string",
        "explanation": "string",
        "improved": "string",
        "error_code": "string"
      }
    ],
    "lexical_resource": [
      {
        "text_snippet": "string",
        "explanation": "string",
        "improved": "string",
        "error_code": "string"
      }
    ]
  },
  "performance_label": "Strong|Developing|Needs Improvement",
  "feedback": ["string", "string"]
}
`;

  const userMessageContent = [{ type: "text", text: fastPrompt }];
  if (imageUrl && taskType === "task1") {
    userMessageContent.push({
      type: "image_url",
      image_url: {
        url: imageUrl,
      },
    });
  }

  try {
    if (!hasOpenAiCredentials) {
      throw new Error("OpenAI API key is not configured");
    }

    const aiResponse = await requestOpenAIJsonWithFallback({
      openai,
      models: FAST_WRITING_MODELS,
      createPayload: (model) => ({
        model,
        messages: [{ role: "user", content: userMessageContent }],
        max_tokens: 900,
        response_format: { type: "json_object" },
      }),
      timeoutMs: Number(process.env.WRITING_FAST_TIMEOUT_MS || process.env.OPENAI_TIMEOUT_MS || 25000),
      maxAttempts: Number(process.env.WRITING_FAST_MAX_ATTEMPTS || process.env.OPENAI_MAX_ATTEMPTS || 2),
    });

    return normalizeFastEssayResult(aiResponse.data, aiResponse.model);
  } catch (error) {
    console.error("gradeEssayFast fallback triggered:", error.message);
    return normalizeFastEssayResult({
      band_score: 0,
      criteria_scores: {
        task_response: 0,
        coherence_cohesion: 0,
        lexical_resource: 0,
        grammatical_range_accuracy: 0,
      },
      summary: "AI fast scoring is temporarily unavailable.",
      criteria_notes: {
        task_response: "",
        coherence_cohesion: "",
        lexical_resource: "",
        grammatical_range_accuracy: "",
      },
      top_issues: {
        grammatical_range_accuracy: [],
        lexical_resource: [],
      },
      performance_label: "Needs Improvement",
      feedback: ["AI fast scoring is temporarily unavailable."],
    }, process.env.WRITING_FAST_MODEL || "gpt-4o-mini");
  }
};


