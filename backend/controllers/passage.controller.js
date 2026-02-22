import Passage from "../models/Passage.model.js";
import { generatePassageQuestionInsights } from "../services/passageInsight.service.js";

const pickPassagePayload = (body = {}, { allowId = false } = {}) => {
    const allowed = ["title", "content", "question_groups", "source"];
    if (allowId) {
        allowed.push("_id");
    }

    return allowed.reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            acc[key] = body[key];
        }
        return acc;
    }, {});
};

export const getAllPassages = async(req, res) => {
    try{
        const passages = await Passage.find({});
        res.status(200).json({ success: true, data : passages});
    } catch(error){
        res.status(500).json({ success: false, message: "Server Error"});
    }
};

export const createPassage = async(req, res) => {
    const passage = pickPassagePayload(req.body, { allowId: true }); // user will send this data by api

    if(!passage.title || !passage.content || !passage.question_groups){
        return res.status(400).json({ success: false, message: "Please provide all info"});
    }

    const newPassage = new Passage(passage);

    try{
        await newPassage.save();
        res.status(201).json({ success: true, data : newPassage });
    }
    catch(error){
        console.error("Create passage error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getPassageById = async(req, res) => {
    const { id } = req.params;
    try {
        const passage = await Passage.findById(id);
        if (!passage) {
            return res.status(404).json({ success: false, message: "Passage not found" });
        }
        res.status(200).json({ success: true, data: passage });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updatePassage = async(req, res) => {
    const { id } = req.params;
    const passage = pickPassagePayload(req.body);

    if (Object.keys(passage).length === 0) {
        return res.status(400).json({ success: false, message: "No valid update fields provided" });
    }

    try {
        const updatedPassage = await Passage.findByIdAndUpdate(id, passage, { new: true });
        if (!updatedPassage) {
            return res.status(404).json({ success: false, message: "Passage not found" });
        }
        res.status(200).json({ success: true, data: updatedPassage });
    } catch (error) {
        console.error("Update passage error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const deletePassage = async(req, res) => {
    const { id } = req.params;
    try{
        const deletedPassage = await Passage.findByIdAndDelete(id);
        if (!deletedPassage) {
            return res.status(404).json({ success: false, message: "Passage not found" });
        }
        return res.status(200).json({ success: true, message: "Delete Success"});
    } catch (error){
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const generatePassageInsights = async (req, res) => {
    try {
        const {
            title = "",
            source = "",
            content = "",
            question_groups = [],
            overwrite_existing = false,
        } = req.body || {};

        const result = await generatePassageQuestionInsights({
            title,
            source,
            content,
            question_groups,
            overwrite_existing,
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        const statusCode = Number(error?.statusCode) || 500;
        console.error("Generate passage insights error:", error);
        return res.status(statusCode).json({
            success: false,
            message: statusCode >= 500 ? "Failed to generate passage insights" : (error.message || "Failed to generate passage insights"),
        });
    }
};
