import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPEN_API_KEY,
});

export const gradeEssay = async (promptText, essayText) => {
    const systemPrompt = `Hãy đóng vai một giám khảo IELTS Writing Task 2 (Band 8.0+), có ít nhất 10 năm kinh nghiệm,
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

━━━━━━━━━━━━━━━━━━━━━━
YÊU CẦU RẤT QUAN TRỌNG (BẮT BUỘC)
━━━━━━━━━━━━━━━━━━━━━━

A) Mỗi tiêu chí phải trả về là MỘT ARRAY riêng (không lồng trong object issues).
B) Mỗi tiêu chí phải cố gắng tìm ÍT NHẤT 10 lỗi/điểm cần cải thiện. 
   - Nếu một tiêu chí không đủ 10 mục, bắt buộc ghi rõ trong explanation: 
     "Không đủ 10 vì bài không có thêm ví dụ/đoạn liên quan tiêu chí này.
      Và đặc biệt lỗi về Grammar và Accuracy thì phải tìm thật kỹ ít nhất 20 lỗi"
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

    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: systemPrompt }],
        max_tokens: 10000,
        response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    try {
        return JSON.parse(content);
    } catch (error) {
        console.error("Error parsing JSON from OpenAI:", error);
        console.error("Raw content:", content);
        throw new Error("AI response was incomplete or invalid JSON. Please try again.");
    }
};
