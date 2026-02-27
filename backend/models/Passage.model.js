import mongoose from "mongoose";
import { PASSAGE_QUESTION_TYPES, QUESTION_GROUP_LAYOUTS } from "../constants/questionTypes.js";


// Schema cho tung cau hoi nho
const QuestionSchema = new mongoose.Schema({
    q_number: { type: Number, required: true }, // So thu tu cac cau hoi
    text: { type: String, required: false },  // Noi dung cau hoi

    option: [
        {
            label: { type: String, required: true }, // A, B, C, D
            text: { type: String, required: true }  // Noi dung lua chon
        }
    ],

    // Đáp án đúng (Lưu mảng để chấp nhận nhiều biến thể đáp án)
    // VD: ["car", "automobile"] hoặc ["A"]
    correct_answers: [{ type: String, required: true }], // Dap an dung

    explanation: { type: String, required: false }, // Giai thich dap an
    passage_reference: { type: String, required: false } // Cum/cau trich dan ngan de doi chieu passage
});

const QuestionHeadingSchema = new mongoose.Schema({
    id: { type: String, required: true },
    text: { type: String, required: true },  // Noi dung lua chon
});
// Schema cho nhom cau hoi ( Question Group )

const QuestionGroupSchema = new mongoose.Schema({

    type: {
        type: String,
        required: true,
        enum: PASSAGE_QUESTION_TYPES
    },

    instructions: { type: String, required: false }, // Huong dan cho nhom cau hoi
    text: { type: String, required: false }, // Noi dung summary (cho summary_completion)
    group_layout: { type: String, enum: QUESTION_GROUP_LAYOUTS, default: 'default' }, // Controls rendering mode
    headings: [QuestionHeadingSchema],
    options: [QuestionHeadingSchema], // Danh sach lua chon sharing (cho summary_completion)
    questions: [QuestionSchema] // Mang cac cau hoi thuoc nhom cau hoi nay
});

const PassageSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    title: { type: String, required: true }, // Tieu de doan van
    content: { type: String, required: true }, // Noi dung doan van
    question_groups: [QuestionGroupSchema],
    source: { type: String }, // Mang cac nhom cau hoi thuoc doan van nay
    is_active: { type: Boolean, default: true }
}, { timestamps: true });


const Passage = mongoose.models.Passage || mongoose.model('Passage', PassageSchema);
export default Passage;

