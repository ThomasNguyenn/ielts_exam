import mongoose from "mongoose";
import Test from "../models/Test.model.js";

export const getAllTests = async(req, res) => {
    try{
        const tests = await Test.find({});
        res.status(200).json({ success: true, data : tests});
    } catch(error){
        res.status(500).json({ success: false, message: "Server Error"});
    }
};

export const createTest = async(req, res) => {
    const test = req.body; // user will send this data by api

    if(!test.title){
        return res.status(400).json({ success: false, message: "Please provide all info"});
    }

    const newTest = new Test(test);

    try{
        await newTest.save();
        res.status(201).json({ success: true, data : newTest });
    }
    catch(error){
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateTest = async(req, res) => {
    const { id } = req.params;

    const test = req.body;

    try{
        const updatedTest = await Test.findByIdAndUpdate(id, test, {new:true});
        res.status(200).json({ success: true, data : updatedTest});
    } catch(error){
        res.status(500).json({ success: false, message: "Server Error"});
    }

};

export const deleteTest = async(req, res) => {
    const { id } = req.params;
    try{
        await Test.findByIdAndDelete(id);
        res.status(201).json({ success: true, message: "Delete Success"});
    } catch (error){
        res.status(404).json({ success: false, message: "Can not find and delete"});
    }
};

export const getTheTestById = async(req, res) => {
    const { id } = req.params;
    try{
        const test = await Test.findById(id).populate('reading_passages').populate('listening_sections');
        if(!test){
            return res.status(404).json({ success: false, message: "Test not found"});
        }
        res.status(200).json({ success: true, data: test });
    } catch(error){
        res.status(500).json({ success: false, message: "Server Error"});
    }
};

/** Strip correct_answers and explanation from items for student exam */
function stripForExam(item) {
    if (!item) return null;
    return {
        _id: item._id,
        title: item.title,
        content: item.content,
        question_groups: (item.question_groups || []).map((g) => ({
            type: g.type,
            instructions: g.instructions,
            headings: g.headings,
            questions: (g.questions || []).map((q) => ({
                q_number: q.q_number,
                text: q.text,
                option: q.option || [],
            })),
        })),
    };
}

export const getExamData = async (req, res) => {
    const { id } = req.params;
    try {
        const test = await Test.findById(id).populate('reading_passages').populate('listening_sections');
        if (!test) {
            return res.status(404).json({ success: false, message: "Test not found" });
        }
        const examType = test.type || 'reading';
        const reading = examType === 'reading'
            ? (test.reading_passages || []).map((p) => stripForExam(p.toObject ? p.toObject() : p))
            : [];
        const listening = examType === 'listening'
            ? (test.listening_sections || []).map((s) => stripForExam(s.toObject ? s.toObject() : s))
            : [];
        res.status(200).json({
            success: true,
            data: {
                testId: test._id,
                title: test.title,
                type: examType,
                reading,
                listening,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/** Normalize answer for comparison */
function normalizeAnswer(val) {
    return String(val || '').trim().toLowerCase();
}

/** Build flat list of correct_answers (one per question) in exam order; optional type filter */
function getCorrectAnswersList(test, examType) {
    const list = [];
    const processItem = (item) => {
        if (!item || !item.question_groups) return;
        for (const g of item.question_groups) {
            for (const q of g.questions || []) {
                list.push((q.correct_answers || []).map(normalizeAnswer));
            }
        }
    };
    const type = examType || test.type || 'reading';
    if (type === 'reading') {
        for (const p of test.reading_passages || []) processItem(p);
    } else {
        for (const s of test.listening_sections || []) processItem(s);
    }
    return list;
}

export const submitExam = async (req, res) => {
    const { id } = req.params;
    const { answers } = req.body || {};
    if (!Array.isArray(answers)) {
        return res.status(400).json({ success: false, message: "answers must be an array" });
    }
    try {
        const test = await Test.findById(id).populate('reading_passages').populate('listening_sections');
        if (!test) {
            return res.status(404).json({ success: false, message: "Test not found" });
        }
        const examType = test.type || 'reading';
        const correctList = getCorrectAnswersList(test, examType);
        const total = correctList.length;
        let score = 0;
        const userNormalized = answers.map((a) => normalizeAnswer(a));
        for (let i = 0; i < correctList.length; i++) {
            const correctOptions = correctList[i];
            const user = i < userNormalized.length ? userNormalized[i] : "";
            if (correctOptions.length && correctOptions.includes(user)) score++;
        }
        const wrong = total - score;
        const readingScore = examType === 'reading' ? score : 0;
        const readingTotal = examType === 'reading' ? total : 0;
        const listeningScore = examType === 'listening' ? score : 0;
        const listeningTotal = examType === 'listening' ? total : 0;

        res.status(200).json({
            success: true,
            data: {
                score,
                total,
                wrong,
                readingScore,
                readingTotal,
                listeningScore,
                listeningTotal,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
