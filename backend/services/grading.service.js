import OpenAI from 'openai';
import { requestOpenAIJsonWithFallback } from '../utils/aiClient.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const hasOpenAiCredentials = Boolean(OPENAI_API_KEY);

const OPENAI_MODELS = [
  process.env.OPENAI_PRIMARY_MODEL || "gpt-4o",
  process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini",
];

export const gradeEssay = async (promptText, essayText, taskType = 'task2', imageUrl = null) => {
  let systemPrompt = '';
  let userMessageContent = [];

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
B) Mỗi tiêu chí phải cố gắng tìm ÍT NHẤT 5-7 lỗi/điểm cần cải thiện (Task 1 ngắn hơn Task 2).
   - Nếu không đủ lỗi, hãy đưa ra gợi ý nâng cao (suggestion).
C) SOI KỸ Task Achievement (TA):
   - Bài viết có overview rõ ràng không?
   - Có highlight key features không?
   - Số liệu có chính xác so với biểu đồ không (nếu có)?
D) Với Lexical Resource (LR):
   - Đưa ra từ vựng thay thế (band 6.0, 6.5) phù hợp ngữ cảnh báo cáo số liệu/biểu đồ.
E) KHÔNG trộn tiêu chí.
   - Task Achievement: nói về việc tóm tắt, so sánh, không đưa ý kiến cá nhân.
F) Mỗi mục phải:
   - text_snippet: trích dẫn
   - explanation: giải thích tiếng Việt
   - improved: sửa lại
   - band_impact: ảnh hưởng điểm số

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
  "task_response": [ ... ], // Nội dung Task Achievement
  "coherence_cohesion": [ ... ],
  "lexical_resource": [ ... ],
  "grammatical_range_accuracy": [ ... ],
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
   - Nếu một tiêu chí không đủ 10 mục, bắt buộc ghi rõ trong explanation: 
     "Không đủ 10 vì bài không có thêm ví dụ/đoạn liên quan tiêu chí này.
      Và đặc biệt lỗi về Grammar và Accuracy và Lexical Resource thì phải tìm thật kỹ ít nhất 20 lỗi"
C) SOI KỸ NHẤT tiêu chí GRA: 
   - Ưu tiên phát hiện lỗi ngữ pháp cơ bản + lỗi lặp lại + lỗi gây khó hiểu.
   - Cố gắng tách lỗi nhỏ thành từng mục (ví dụ: 1 câu có 3 lỗi → tách 3 mục).
D) Với Lexical Resource (LR):
   - Mỗi mục lỗi từ vựng/collocation phải đưa:
     + "band6_replacement": từ/cụm thay thế phù hợp khoảng Band 6.0
     + "band65_replacement": từ/cụm thay thế phù hợp khoảng Band 6.5
   - Chỉ đưa replacement có nghĩa đúng theo ngữ cảnh, không thay bừa.
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
      "explanation": "string (Vietnamese)",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "coherence_cohesion": [
    {
      "text_snippet": "string",
      "type": "error|good|suggestion",
      "explanation": "string (Vietnamese)",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "lexical_resource": [
    {
      "text_snippet": "string",
      "type": "error|good|suggestion",
      "explanation": "string (Vietnamese)",
      "improved": "string",
      "band6_replacement": "string",
      "band65_replacement": "string",
      "band_impact": "string"
    }
  ],
  "grammatical_range_accuracy": [
    {
      "text_snippet": "string",
      "type": "error|good|suggestion",
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
    return aiResult.data;
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
