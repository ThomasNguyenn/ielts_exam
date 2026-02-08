import mongoose from "mongoose";


// Schema cho tung cau hoi nho
const QuestionSchema = new mongoose.Schema({
    q_number: { type : Number, required: true }, // So thu tu cac cau hoi
    text: { type: String, required: false },  // Noi dung cau hoi

    option: [
        {label: { type: String, required: true }, // A, B, C, D
        text: { type: String }  // Noi dung lua chon
    }
    ],

    // Đáp án đúng (Lưu mảng để chấp nhận nhiều biến thể đáp án)
    // VD: ["car", "automobile"] hoặc ["A"]
    correct_answers: [{ type: String, required: true }], // Dap an dung

    explanation: { type: String, required: false } // Giai thich dap an
});

const QuestionHeadingSchema = new mongoose.Schema({
    id: { type: String, required: true },
    text: { type: String},
});

// Schema cho nhom cau hoi ( Question Group )

const QuestionGroupSchema = new mongoose.Schema({

    type:{
        type: String,
        required: true,
        enum : ['true_false_notgiven', 'gap_fill','matching_headings','mult_choice','matching_features', 'summary_completion', 'listening_map', 'matching_information']
    },

    instructions: { type: String, required: false }, // Huong dan cho nhom cau hoi
    text: { type: String, required: false }, // Noi dung summary
    headings: [QuestionHeadingSchema], // For matching_headings / matching_features
    options: [QuestionHeadingSchema], // For summary_completion options
    questions: [QuestionSchema] // Mang cac cau hoi thuoc nhom cau hoi nay
});

const SectionSchema = new mongoose.Schema({
    _id : { type: String, required: true },
    title: { type: String, required: true }, // Tieu de doan van
    content: { type: String, required: true }, // Noi dung doan van
    audio_url: { type: String }, // URL to MP3 audio file for listening section
    question_groups: [QuestionGroupSchema],
    source : {type : String} // Mang cac nhom cau hoi thuoc doan van nay
}, { timestamps: true });


const Section = mongoose.model('Section',SectionSchema);
export default Section;