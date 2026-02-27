import Section from "../models/Section.model.js";
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

const pickSectionPayload = (body = {}, { allowId = false } = {}) => {
    const allowed = ["title", "content", "audio_url", "question_groups", "source", "is_active"];
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

    return payload;
};

export const getAllSections = async(req, res) => {
    try{
        const sections = await Section.find({});
        res.status(200).json({ success: true, data : sections});
    } catch(error){
        return handleControllerError(req, res, error);
    }
};

export const createSection = async(req, res) => {
    const section = pickSectionPayload(req.body, { allowId: true }); // user will send this data by api

    if(!section.title || !section.content || !section.question_groups){
        return sendControllerError(req, res, { statusCode: 400, message: "Please provide all info" });
    }

    const newSection = new Section(section);

    try{
        await newSection.save();
        res.status(201).json({ success: true, data : newSection });
    }
    catch(error){
        return handleControllerError(req, res, error);
    }
};

export const getSectionById = async(req, res) => {
    const { id } = req.params;
    try {
        const section = await Section.findById(id);
        if (!section) {
            return sendControllerError(req, res, { statusCode: 404, message: "Section not found"  });
        }
        res.status(200).json({ success: true, data: section });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const updateSection = async(req, res) => {
    const { id } = req.params;
    const section = pickSectionPayload(req.body);

    if (Object.keys(section).length === 0) {
        return sendControllerError(req, res, { statusCode: 400, message: "No valid update fields provided"  });
    }

    try {
        const updatedSection = await Section.findByIdAndUpdate(id, section, { new: true });
        if (!updatedSection) {
            return sendControllerError(req, res, { statusCode: 404, message: "Section not found"  });
        }
        res.status(200).json({ success: true, data: updatedSection });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const deleteSection = async(req, res) => {
    const { id } = req.params;
    try{
        const deletedSection = await Section.findByIdAndDelete(id);
        if (!deletedSection) {
            return sendControllerError(req, res, { statusCode: 404, message: "Section not found"  });
        }
        return res.status(200).json({ success: true, message: "Delete Success"});
    } catch (error){
        return handleControllerError(req, res, error);
    }
};


