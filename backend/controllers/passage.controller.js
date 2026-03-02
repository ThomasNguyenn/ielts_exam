import Passage from "../models/Passage.model.js";
import { generatePassageQuestionInsights } from "../services/passageInsight.service.js";
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

const pickPassagePayload = (body = {}, { allowId = false } = {}) => {
    const allowed = ["title", "content", "question_groups", "source", "is_active", "isSinglePart"];
    if (allowId) {
        allowed.push("_id");
    }

    const payload = allowed.reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            acc[key] = body[key];
        }
        return acc;
    }, {});

    // Backward-compatible alias from older frontend payloads
    if (!Object.prototype.hasOwnProperty.call(payload, "is_active") && Object.prototype.hasOwnProperty.call(body, "isActive")) {
        payload.is_active = body.isActive;
    }

    // Normalize isSinglePart to boolean when present
    if (Object.prototype.hasOwnProperty.call(payload, "isSinglePart")) {
        payload.isSinglePart = Boolean(payload.isSinglePart);
    }

    return payload;
};

export const getAllPassages = async(req, res) => {
    try{
        const passages = await Passage.find({});
        res.status(200).json({ success: true, data : passages});
    } catch(error){
        return handleControllerError(req, res, error);
    }
};

export const createPassage = async(req, res) => {
    const passage = pickPassagePayload(req.body, { allowId: true }); // user will send this data by api

    if(!passage.title || !passage.content || !passage.question_groups){
        return sendControllerError(req, res, { statusCode: 400, message: "Please provide all info" });
    }

    const newPassage = new Passage(passage);

    try{
        await newPassage.save();
        res.status(201).json({ success: true, data : newPassage });
    }
    catch(error){
        return handleControllerError(req, res, error);
    }
};

export const getPassageById = async(req, res) => {
    const { id } = req.params;
    try {
        const passage = await Passage.findById(id);
        if (!passage) {
            return sendControllerError(req, res, { statusCode: 404, message: "Passage not found"  });
        }
        res.status(200).json({ success: true, data: passage });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const updatePassage = async(req, res) => {
    const { id } = req.params;
    const passage = pickPassagePayload(req.body);

    if (Object.keys(passage).length === 0) {
        return sendControllerError(req, res, { statusCode: 400, message: "No valid update fields provided"  });
    }

    try {
        const updatedPassage = await Passage.findByIdAndUpdate(id, passage, { new: true });
        if (!updatedPassage) {
            return sendControllerError(req, res, { statusCode: 404, message: "Passage not found"  });
        }
        res.status(200).json({ success: true, data: updatedPassage });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const deletePassage = async(req, res) => {
    const { id } = req.params;
    try{
        const deletedPassage = await Passage.findByIdAndDelete(id);
        if (!deletedPassage) {
            return sendControllerError(req, res, { statusCode: 404, message: "Passage not found"  });
        }
        return res.status(200).json({ success: true, message: "Delete Success"});
    } catch (error){
        return handleControllerError(req, res, error);
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
        const message = statusCode >= 500
            ? "Failed to generate passage insights"
            : (error.message || "Failed to generate passage insights");
        return handleControllerError(req, res, error, { statusCode, message });
    }
};


