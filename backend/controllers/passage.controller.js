import Passage from "../models/Passage.model.js";
import { generatePassageQuestionInsights } from "../services/passageInsight.service.js";
import {
    assertObjectiveAnswerMappings,
    ObjectiveAnswerValidationError,
} from "../services/objectiveAnswerValidation.service.js";
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

const isTeacherOrAdminRequest = (req) => (
    req.user?.role === "teacher" || req.user?.role === "admin"
);

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

const validateObjectiveMappingsOrRespond = (req, res, questionGroups) => {
    try {
        assertObjectiveAnswerMappings(questionGroups);
        return true;
    } catch (error) {
        if (error instanceof ObjectiveAnswerValidationError) {
            sendControllerError(req, res, {
                statusCode: error.statusCode,
                code: error.code,
                message: error.message,
                details: error.details,
            });
            return false;
        }
        throw error;
    }
};

export const getAllPassages = async(req, res) => {
    try{
        const privileged = isTeacherOrAdminRequest(req);
        const summaryMode = ["1", "true", "yes"].includes(String(req.query?.summary || "").toLowerCase());
        const includeQuestionGroupTypes = !["0", "false", "no"].includes(
            String(req.query?.includeQuestionGroupTypes || "").toLowerCase(),
        );
        const limitValue = Number(req.query?.limit);
        const limit =
            Number.isFinite(limitValue) && limitValue > 0
                ? Math.min(Math.floor(limitValue), 5000)
                : null;
        const filter = privileged ? {} : { is_active: true };

        if (!privileged) {
            let query = Passage.find(filter)
                .sort({ updatedAt: -1, createdAt: -1 })
                .select([
                    "_id",
                    "title",
                    "source",
                    "is_active",
                    "isSinglePart",
                    "question_groups.type",
                    "createdAt",
                    "updatedAt",
                    "created_at",
                    "updated_at",
                ].join(" "));

            if (limit) query = query.limit(limit);

            const passages = await query.lean();
            const sanitized = passages.map((passage) => ({
                _id: passage._id,
                title: passage.title,
                source: passage.source || "",
                is_active: passage.is_active !== false,
                isSinglePart: Boolean(passage.isSinglePart),
                question_groups: includeQuestionGroupTypes
                    ? (Array.isArray(passage.question_groups) ? passage.question_groups : [])
                        .map((group) => ({ type: group?.type }))
                        .filter((group) => Boolean(group.type))
                    : [],
                createdAt: passage.createdAt || null,
                updatedAt: passage.updatedAt || null,
                created_at: passage.created_at || null,
                updated_at: passage.updated_at || null,
            }));

            return res.status(200).json({ success: true, data: sanitized });
        }

        let passages;
        if (summaryMode) {
            const pipeline = [
                { $match: filter },
                { $sort: { updatedAt: -1, createdAt: -1 } },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        source: 1,
                        is_active: 1,
                        isSinglePart: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        created_at: 1,
                        updated_at: 1,
                        question_count: {
                            $sum: {
                                $map: {
                                    input: { $ifNull: ["$question_groups", []] },
                                    as: "group",
                                    in: { $size: { $ifNull: ["$$group.questions", []] } },
                                },
                            },
                        },
                    },
                },
            ];
            if (limit) pipeline.push({ $limit: limit });
            passages = await Passage.aggregate(pipeline);
        } else {
            let query = Passage.find(filter);
            if (limit) query = query.limit(limit);
            passages = await query.lean();
        }
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

    if (!validateObjectiveMappingsOrRespond(req, res, passage.question_groups)) {
        return;
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

    if (
        Object.prototype.hasOwnProperty.call(passage, "question_groups") &&
        !validateObjectiveMappingsOrRespond(req, res, passage.question_groups)
    ) {
        return;
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

export const uploadPassageDiagramImage = async (req, res) => {
    try {
        if (!req.file) {
            return sendControllerError(req, res, { statusCode: 400, message: "No file uploaded" });
        }

        const cloudinary = (await import("../utils/cloudinary.js")).default;
        const base64 = Buffer.from(req.file.buffer).toString("base64");
        const dataUri = `data:${req.file.mimetype};base64,${base64}`;

        const result = await cloudinary.uploader.upload(dataUri, {
            folder: "ielts-diagram-label",
        });

        return res.status(200).json({
            success: true,
            data: {
                url: result.secure_url,
                public_id: result.public_id,
            },
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};


