import Section from "../models/Section.model.js";
import {
    buildSectionAudioObjectKey,
    deleteSectionAudioObject,
    isObjectStorageConfigured,
    uploadSectionAudioObject,
} from "../services/objectStorage.service.js";
import {
    assertObjectiveAnswerMappings,
    ObjectiveAnswerValidationError,
} from "../services/objectiveAnswerValidation.service.js";
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

const pickSectionPayload = (body = {}, { allowId = false } = {}) => {
    const allowed = ["title", "content", "transcript", "audio_url", "audio_storage_key", "question_groups", "source", "is_active", "isSinglePart"];
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

const normalizeOptionalString = (value) => {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
};

const normalizeSectionCreatePayload = (payload = {}) => {
    const normalized = { ...payload };

    if (Object.prototype.hasOwnProperty.call(normalized, "audio_url")) {
        const audioUrl = normalizeOptionalString(normalized.audio_url);
        if (audioUrl) normalized.audio_url = audioUrl;
        else delete normalized.audio_url;
    }

    if (Object.prototype.hasOwnProperty.call(normalized, "audio_storage_key")) {
        const audioStorageKey = normalizeOptionalString(normalized.audio_storage_key);
        if (audioStorageKey) normalized.audio_storage_key = audioStorageKey;
        else delete normalized.audio_storage_key;
    }

    return normalized;
};

const buildSectionUpdateDocument = (payload = {}) => {
    const set = {};
    const unset = {};

    Object.entries(payload).forEach(([key, value]) => {
        if (key === "audio_url" || key === "audio_storage_key") {
            const normalized = normalizeOptionalString(value);
            if (normalized) {
                set[key] = normalized;
            } else {
                unset[key] = "";
            }
            return;
        }

        set[key] = value;
    });

    const update = {};
    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;
    return update;
};

const warnStorageDeleteFailure = (req, sectionId, audioStorageKey, error) => {
    console.warn(JSON.stringify({
        ts: new Date().toISOString(),
        level: "warn",
        route: req?.route?.path || "sections",
        requestId: req?.requestId || null,
        sectionId: sectionId || null,
        audioStorageKey: audioStorageKey || null,
        message: "Failed to delete section audio object from storage",
        error: {
            code: error?.code || null,
            message: error?.message || "Unknown delete error",
        },
    }));
};

const deleteSectionAudioBestEffort = async (req, sectionId, audioStorageKey) => {
    const normalizedKey = normalizeOptionalString(audioStorageKey);
    if (!normalizedKey) return;

    try {
        await deleteSectionAudioObject(normalizedKey);
    } catch (error) {
        warnStorageDeleteFailure(req, sectionId, normalizedKey, error);
    }
};

export const getAllSections = async(req, res) => {
    try{
        const summaryMode = ["1", "true", "yes"].includes(String(req.query?.summary || "").toLowerCase());
        const limitValue = Number(req.query?.limit);
        const limit =
            Number.isFinite(limitValue) && limitValue > 0
                ? Math.min(Math.floor(limitValue), 5000)
                : null;

        let sections;
        if (summaryMode) {
            const pipeline = [
                { $sort: { updatedAt: -1, createdAt: -1 } },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        source: 1,
                        is_active: 1,
                        createdAt: 1,
                        updatedAt: 1,
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
            sections = await Section.aggregate(pipeline);
        } else {
            let query = Section.find({});
            if (limit) query = query.limit(limit);
            sections = await query.lean();
        }
        res.status(200).json({ success: true, data : sections});
    } catch(error){
        return handleControllerError(req, res, error);
    }
};

export const createSection = async(req, res) => {
    const section = normalizeSectionCreatePayload(
        pickSectionPayload(req.body, { allowId: true }),
    ); // user will send this data by api

    if(!section.title || !section.content || !section.question_groups){
        return sendControllerError(req, res, { statusCode: 400, message: "Please provide all info" });
    }

    if (!validateObjectiveMappingsOrRespond(req, res, section.question_groups)) {
        return;
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

    if (
        Object.prototype.hasOwnProperty.call(section, "question_groups") &&
        !validateObjectiveMappingsOrRespond(req, res, section.question_groups)
    ) {
        return;
    }

    try {
        const existingSection = await Section.findById(id);
        if (!existingSection) {
            return sendControllerError(req, res, { statusCode: 404, message: "Section not found"  });
        }

        const hasNewAudioStorageKey = Object.prototype.hasOwnProperty.call(section, "audio_storage_key");
        if (hasNewAudioStorageKey) {
            const currentAudioStorageKey = normalizeOptionalString(existingSection.audio_storage_key);
            const nextAudioStorageKey = normalizeOptionalString(section.audio_storage_key);
            if (currentAudioStorageKey && currentAudioStorageKey !== nextAudioStorageKey) {
                await deleteSectionAudioBestEffort(req, existingSection._id, currentAudioStorageKey);
            }
        }

        const updateDocument = buildSectionUpdateDocument(section);
        if (!updateDocument.$set && !updateDocument.$unset) {
            return sendControllerError(req, res, { statusCode: 400, message: "No valid update fields provided" });
        }

        const updatedSection = await Section.findByIdAndUpdate(id, updateDocument, { new: true, runValidators: true });
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
        const section = await Section.findById(id);
        if (!section) {
            return sendControllerError(req, res, { statusCode: 404, message: "Section not found"  });
        }

        await deleteSectionAudioBestEffort(req, section._id, section.audio_storage_key);
        await Section.findByIdAndDelete(id);
        return res.status(200).json({ success: true, message: "Delete Success"});
    } catch (error){
        return handleControllerError(req, res, error);
    }
};

export const uploadSectionAudio = async (req, res) => {
    try {
        if (!isObjectStorageConfigured()) {
            return sendControllerError(req, res, {
                statusCode: 503,
                code: "OBJECT_STORAGE_NOT_CONFIGURED",
                message: "Object storage is not configured",
            });
        }

        if (!req.file) {
            return sendControllerError(req, res, {
                statusCode: 400,
                code: "AUDIO_FILE_REQUIRED",
                message: "Audio file is required",
            });
        }

        const file = req.file;
        const sectionId = req.body?.section_id || req.body?.sectionId || "temp";
        const key = buildSectionAudioObjectKey({
            sectionId,
            originalFileName: file.originalname,
        });

        const uploaded = await uploadSectionAudioObject({
            key,
            buffer: file.buffer,
            contentType: file.mimetype || "audio/mpeg",
            size: file.size,
        });

        return res.status(200).json({
            success: true,
            data: {
                url: uploaded.url,
                key: uploaded.key,
                contentType: file.mimetype || "audio/mpeg",
                size: file.size,
            },
        });
    } catch (error) {
        if (error?.statusCode) {
            return sendControllerError(req, res, {
                statusCode: error.statusCode,
                code: error.code,
                message: error.message,
            });
        }
        return handleControllerError(req, res, error);
    }
};
