import OpenAI from 'openai';
import { requestOpenAITextWithFallback } from '../utils/aiClient.js';
import dotenv from 'dotenv';
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const OPENAI_MODELS = [
    process.env.OPENAI_PRIMARY_MODEL || "gpt-4o",
    process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini",
];

// In-memory store for evaluation statuses (In production, use Redis or a DB)
const evaluationStore = new Map();

export const submitEvaluations = async (req, res) => {
    try {
        const { students, teacherName, date } = req.body;

        if (!Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid student list" });
        }

        const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        
        // Initialize status for each student
        const tasks = students.map((student, index) => ({
            id: index,
            studentName: student.name,
            lessonInfo: student.lessonInfo,
            status: 'pending',
            result: null,
            error: null
        }));

        evaluationStore.set(requestId, {
            tasks,
            teacherName,
            date,
            completedCount: 0,
            totalCount: tasks.length
        });

        // Start background processing
        processEvaluationQueue(requestId);

        return res.status(202).json({
            success: true,
            requestId,
            message: "Evaluations submitted and processing in background"
        });
    } catch (error) {
        console.error("Submit Evaluations Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getEvaluationStatus = async (req, res) => {
    const { requestId } = req.params;
    const data = evaluationStore.get(requestId);

    if (!data) {
        return res.status(404).json({ success: false, message: "Request ID not found" });
    }

    return res.json({
        success: true,
        requestId,
        tasks: data.tasks,
        completedCount: data.completedCount,
        totalCount: data.totalCount
    });
};

async function processEvaluationQueue(requestId) {
    const data = evaluationStore.get(requestId);
    if (!data) return;

    const { tasks, teacherName, date } = data;

    for (const task of tasks) {
        if (task.status !== 'pending') continue;

        task.status = 'processing';
        
        try {
            const prompt = `Bạn là trợ lý học thuật chính thức của trung tâm SCOTS Cẩm Phả.

Nhiệm vụ của bạn là viết nhận xét buổi học cho học viên theo đúng format chuẩn của trung tâm.

QUY ĐỊNH BẮT BUỘC:
1. Luôn giữ nguyên cấu trúc và thứ tự các mục.
2. Không được thêm hoặc bớt bất kỳ mục nào.
3. Không được thêm emoji.
4. Văn phong chuyên nghiệp, tích cực, mang tính xây dựng.
5. Nhận xét phải cụ thể, cá nhân hóa theo từng học viên dựa trên dữ liệu đầu vào.
6. Lớp học là hình thức 1-1 (học cá nhân), vì vậy tuyệt đối không sử dụng các cụm từ:
   - thảo luận nhóm
   - làm việc nhóm
   - hoạt động nhóm
7. Nếu có nhiều học viên, mỗi học viên phải có đầy đủ 6 mục riêng biệt theo đúng format.

FORMAT BẮT BUỘC:

[SCOTS CẨM PHẢ - BỘ PHẬN HỌC THUẬT]
NHẬN XÉT BUỔI HỌC

Học viên: ${task.studentName}
Tuần học: ${date}
Giáo viên: ${teacherName}

Nội dung bài học:
${task.lessonInfo || 'N/A'}

Nhận xét buổi học:
...

Thái độ học tập:
...

Hiệu quả tiếp thu:
...

Cần cải thiện:
...

Không giải thích thêm. Không viết ngoài format.
Chỉ trả về nội dung hoàn chỉnh theo đúng cấu trúc trên.`;

            const aiResponse = await requestOpenAITextWithFallback({
                openai,
                models: OPENAI_MODELS,
                createPayload: (model) => ({
                    model,
                    messages: [
                        { role: "system", content: "You are an academic assistant for SCOTS Cẩm Phả English Center." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7,
                }),
                timeoutMs: 30000,
            });

            task.result = aiResponse.rawText;
            task.status = 'completed';
        } catch (error) {
            console.error(`Error evaluating ${task.studentName}:`, error);
            task.status = 'error';
            task.error = error.message;
        }

        data.completedCount++;
        // Keep the store updated
        evaluationStore.set(requestId, data);
    }
}
