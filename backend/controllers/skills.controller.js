import SkillModule from '../models/SkillModule.model.js';
import StudentProgress from '../models/StudentProgress.model.js';

import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

const SKILL_CATEGORIES = ['listening', 'reading', 'writing', 'speaking'];
const SKILL_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const DEFAULT_CATEGORY = 'writing';
const DEFAULT_DIFFICULTY = 'beginner';
const PASS_SCORE = 70;

const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const toNormalizedString = (value) => String(value ?? '').trim().toLowerCase();

const normalizeCategoryValue = (value) => {
    const normalized = toNormalizedString(value);
    if (!normalized) return DEFAULT_CATEGORY;
    return SKILL_CATEGORIES.includes(normalized) ? normalized : DEFAULT_CATEGORY;
};

const normalizeDifficultyValue = (value) => {
    const normalized = toNormalizedString(value);
    if (!normalized) return DEFAULT_DIFFICULTY;
    return SKILL_DIFFICULTIES.includes(normalized) ? normalized : DEFAULT_DIFFICULTY;
};

const toStringArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);
};

const toResources = (value) => {
    if (!Array.isArray(value)) return [];

    return value
        .map((resource) => ({
            title: String(resource?.title ?? '').trim(),
            url: String(resource?.url ?? '').trim(),
            type: String(resource?.type ?? 'article').trim() || 'article',
            description: String(resource?.description ?? '').trim(),
        }))
        .filter((resource) => resource.title && resource.url);
};

const toCheckpointQuiz = (value) => {
    if (!Array.isArray(value)) return [];

    return value
        .map((question) => {
            const options = toStringArray(question?.options);
            const correctAnswer = toNumber(question?.correctAnswer, -1);

            if (!String(question?.question ?? '').trim()) return null;
            if (options.length < 2) return null;
            if (correctAnswer < 0 || correctAnswer >= options.length) return null;

            return {
                question: String(question.question).trim(),
                options,
                correctAnswer,
                explanation: String(question?.explanation ?? '').trim(),
            };
        })
        .filter(Boolean);
};

const validateEnumInput = (fieldName, rawValue, allowedValues) => {
    const normalized = toNormalizedString(rawValue);
    if (!normalized) return null;
    if (allowedValues.includes(normalized)) return null;
    return `${fieldName} must be one of: ${allowedValues.join(', ')}`;
};

const validateModuleMetadataPayload = (body = {}, isUpdate = false) => {
    if (!isUpdate || hasOwn(body, 'category')) {
        const categoryError = validateEnumInput('category', body.category, SKILL_CATEGORIES);
        if (categoryError) return categoryError;
    }

    if (!isUpdate || hasOwn(body, 'difficulty')) {
        const difficultyError = validateEnumInput('difficulty', body.difficulty, SKILL_DIFFICULTIES);
        if (difficultyError) return difficultyError;
    }

    return null;
};

const sanitizeModuleForResponse = (module, extras = {}) => {
    const source = module && typeof module === 'object' ? module : {};
    const { unlockRequirement: _legacyUnlockRequirement, ...rest } = source;

    return {
        ...rest,
        category: normalizeCategoryValue(rest.category),
        difficulty: normalizeDifficultyValue(rest.difficulty),
        tag: String(rest.tag ?? '').trim(),
        path: String(rest.path ?? '').trim(),
        ...extras,
    };
};

const buildContentPayload = (content = {}, isUpdate = false) => {
    const payload = {};

    if (!isUpdate || hasOwn(content, 'lesson')) {
        payload.lesson = String(content.lesson ?? '').trim();
    }
    if (!isUpdate || hasOwn(content, 'videoUrl')) {
        payload.videoUrl = String(content.videoUrl ?? '').trim();
    }
    if (!isUpdate || hasOwn(content, 'examples')) {
        payload.examples = toStringArray(content.examples);
    }
    if (!isUpdate || hasOwn(content, 'keyPoints')) {
        payload.keyPoints = toStringArray(content.keyPoints);
    }
    if (!isUpdate || hasOwn(content, 'resources')) {
        payload.resources = toResources(content.resources);
    }
    if (!isUpdate || hasOwn(content, 'checkpointQuiz')) {
        payload.checkpointQuiz = toCheckpointQuiz(content.checkpointQuiz);
    }

    return payload;
};

const buildModulePayload = (body = {}, isUpdate = false) => {
    const payload = {};

    if (hasOwn(body, 'moduleNumber')) {
        payload.moduleNumber = Math.max(1, toNumber(body.moduleNumber, 1));
    }
    if (!isUpdate || hasOwn(body, 'title')) {
        payload.title = String(body.title ?? '').trim();
    }
    if (!isUpdate || hasOwn(body, 'description')) {
        payload.description = String(body.description ?? '').trim();
    }
    if (!isUpdate || hasOwn(body, 'estimatedMinutes')) {
        payload.estimatedMinutes = Math.max(1, toNumber(body.estimatedMinutes, 10));
    }
    if (!isUpdate || hasOwn(body, 'icon')) {
        payload.icon = String(body.icon ?? '📚').trim() || '📚';
    }
    if (hasOwn(body, 'order')) {
        payload.order = Math.max(1, toNumber(body.order, 1));
    }
    if (!isUpdate) {
        payload.isActive = hasOwn(body, 'isActive') ? Boolean(body.isActive) : true;
    } else if (hasOwn(body, 'isActive')) {
        payload.isActive = Boolean(body.isActive);
    }

    if (!isUpdate || hasOwn(body, 'category')) {
        payload.category = normalizeCategoryValue(body.category);
    }
    if (!isUpdate || hasOwn(body, 'difficulty')) {
        payload.difficulty = normalizeDifficultyValue(body.difficulty);
    }
    if (!isUpdate || hasOwn(body, 'tag')) {
        payload.tag = String(body.tag ?? '').trim();
    }
    if (!isUpdate || hasOwn(body, 'path')) {
        payload.path = String(body.path ?? '').trim();
    }

    if (!isUpdate || hasOwn(body, 'content')) {
        payload.content = buildContentPayload(body.content || {}, isUpdate);
    }

    return payload;
};

const buildCategoryFilter = (categoryQuery) => {
    const baseFilter = { isActive: true };
    if (!categoryQuery) return baseFilter;

    if (categoryQuery === DEFAULT_CATEGORY) {
        return {
            ...baseFilter,
            $or: [
                { category: DEFAULT_CATEGORY },
                { category: { $exists: false } },
                { category: null },
                { category: '' },
            ],
        };
    }

    return {
        ...baseFilter,
        category: categoryQuery,
    };
};

const getPopularityCountMap = async (moduleIds = []) => {
    const popularityMap = new Map();
    if (!Array.isArray(moduleIds) || moduleIds.length === 0) return popularityMap;

    const rows = await StudentProgress.aggregate([
        { $unwind: '$completedModules' },
        { $match: { 'completedModules.moduleId': { $in: moduleIds } } },
        {
            $group: {
                _id: '$completedModules.moduleId',
                count: { $sum: 1 },
            },
        },
    ]);

    rows.forEach((row) => {
        popularityMap.set(String(row._id), Number(row.count) || 0);
    });

    return popularityMap;
};

const syncModuleOrderNumbers = async () => {
    const modules = await SkillModule.find({ isActive: true })
        .sort({ order: 1, moduleNumber: 1, createdAt: 1 });

    for (let index = 0; index < modules.length; index++) {
        const module = modules[index];
        const expectedOrder = index + 1;
        const setOps = {};

        if (module.order !== expectedOrder) setOps.order = expectedOrder;
        if (module.moduleNumber !== expectedOrder) setOps.moduleNumber = expectedOrder;

        if (Object.keys(setOps).length > 0) {
            await SkillModule.updateOne(
                { _id: module._id },
                { $set: setOps },
            );
        }
    }
};

// Student: Get categories summary
export const getCategories = async (req, res) => {
    try {
        const modules = await SkillModule.find({ isActive: true })
            .select('category estimatedMinutes')
            .lean();

        const summaries = new Map(
            SKILL_CATEGORIES.map((category) => [
                category,
                { category, moduleCount: 0, totalMinutes: 0 },
            ]),
        );

        modules.forEach((module) => {
            const category = normalizeCategoryValue(module.category);
            const summary = summaries.get(category) || summaries.get(DEFAULT_CATEGORY);
            summary.moduleCount += 1;
            summary.totalMinutes += Math.max(0, toNumber(module.estimatedMinutes, 0));
        });

        const data = SKILL_CATEGORIES.map((category) => summaries.get(category));
        return res.json({ success: true, data });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Student: Get all active modules without answer keys
export const getAllModules = async (req, res) => {
    try {
        const categoryQuery = toNormalizedString(req.query?.category);
        if (categoryQuery && !SKILL_CATEGORIES.includes(categoryQuery)) {
            return sendControllerError(req, res, {
                statusCode: 400,
                message: `category must be one of: ${SKILL_CATEGORIES.join(', ')}`,
            });
        }

        const filter = buildCategoryFilter(categoryQuery || null);
        const modules = await SkillModule.find(filter)
            .sort({ order: 1, moduleNumber: 1 })
            .select('-content.checkpointQuiz.correctAnswer')
            .lean();

        const popularityMap = await getPopularityCountMap(modules.map((module) => module._id));
        const data = modules.map((module) =>
            sanitizeModuleForResponse(module, {
                popularityCount: popularityMap.get(String(module._id)) || 0,
            }),
        );

        return res.json({ success: true, data });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Student: Get one active module without answer keys
export const getModuleById = async (req, res) => {
    try {
        const { id } = req.params;
        const module = await SkillModule.findOne({ _id: id, isActive: true })
            .select('-content.checkpointQuiz.correctAnswer')
            .lean();

        if (!module) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Module not found' });
        }

        return res.json({ success: true, data: sanitizeModuleForResponse(module) });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Teacher/Admin: Get modules with full data (including quiz answer keys)
export const getAllModulesForManage = async (req, res) => {
    try {
        const includeInactive = String(req.query.includeInactive ?? 'true') !== 'false';
        const filter = includeInactive ? {} : { isActive: true };

        const modules = await SkillModule.find(filter)
            .sort({ order: 1, moduleNumber: 1 })
            .lean();

        return res.json({
            success: true,
            data: modules.map((module) => sanitizeModuleForResponse(module)),
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Teacher/Admin: Get one module with full data
export const getModuleByIdForManage = async (req, res) => {
    try {
        const { id } = req.params;
        const module = await SkillModule.findById(id).lean();

        if (!module) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Module not found' });
        }

        return res.json({ success: true, data: sanitizeModuleForResponse(module) });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Teacher/Admin: Create module
export const createModule = async (req, res) => {
    try {
        const validationMessage = validateModuleMetadataPayload(req.body, false);
        if (validationMessage) {
            return sendControllerError(req, res, { statusCode: 400, message: validationMessage });
        }

        const payload = buildModulePayload(req.body, false);

        if (!payload.title || !payload.description || !payload.content?.lesson) {
            return sendControllerError(req, res, {
                statusCode: 400,
                message: 'title, description, and content.lesson are required',
            });
        }

        const maxOrderModule = await SkillModule.findOne({}).sort({ order: -1 }).select('order').lean();
        const nextOrder = (maxOrderModule?.order || 0) + 1;
        payload.order = payload.order || nextOrder;
        payload.moduleNumber = payload.moduleNumber || payload.order;

        const created = await SkillModule.create(payload);
        await syncModuleOrderNumbers();

        const saved = await SkillModule.findById(created._id).lean();
        return res.status(201).json({ success: true, data: sanitizeModuleForResponse(saved) });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Teacher/Admin: Update module
export const updateModule = async (req, res) => {
    try {
        const validationMessage = validateModuleMetadataPayload(req.body, true);
        if (validationMessage) {
            return sendControllerError(req, res, { statusCode: 400, message: validationMessage });
        }

        const { id } = req.params;
        const payload = buildModulePayload(req.body, true);

        if (Object.keys(payload).length === 0) {
            return sendControllerError(req, res, { statusCode: 400, message: 'No updates provided' });
        }

        if (payload.content && hasOwn(payload.content, 'lesson') && !payload.content.lesson) {
            return sendControllerError(req, res, { statusCode: 400, message: 'content.lesson cannot be empty' });
        }

        const updated = await SkillModule.findByIdAndUpdate(id, payload, {
            new: true,
            runValidators: true,
        });

        if (!updated) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Module not found' });
        }

        await syncModuleOrderNumbers();
        const refreshed = await SkillModule.findById(id).lean();

        return res.json({ success: true, data: sanitizeModuleForResponse(refreshed) });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Teacher/Admin: Soft delete module (disable)
export const deleteModule = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await SkillModule.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true },
        );

        if (!deleted) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Module not found' });
        }

        await syncModuleOrderNumbers();
        return res.json({ success: true, message: 'Module disabled successfully' });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Teacher/Admin: Reorder active modules with explicit sequence
export const reorderModules = async (req, res) => {
    try {
        const moduleIds = Array.isArray(req.body?.moduleIds)
            ? req.body.moduleIds.map((id) => String(id))
            : [];

        if (moduleIds.length === 0) {
            return sendControllerError(req, res, { statusCode: 400, message: 'moduleIds must be a non-empty array' });
        }

        const uniqueIds = [...new Set(moduleIds)];
        if (uniqueIds.length !== moduleIds.length) {
            return sendControllerError(req, res, { statusCode: 400, message: 'moduleIds contains duplicates' });
        }

        const activeModules = await SkillModule.find({ isActive: true }).select('_id').lean();
        const activeIds = activeModules.map((module) => String(module._id));

        if (activeIds.length !== moduleIds.length) {
            return sendControllerError(req, res, {
                statusCode: 400,
                message: 'moduleIds must include all active modules exactly once',
            });
        }

        const incomingSet = new Set(moduleIds);
        const isExactMatch = activeIds.every((id) => incomingSet.has(id));
        if (!isExactMatch) {
            return sendControllerError(req, res, {
                statusCode: 400,
                message: 'moduleIds must match active module ids',
            });
        }

        for (let index = 0; index < moduleIds.length; index++) {
            const id = moduleIds[index];

            await SkillModule.updateOne(
                { _id: id },
                {
                    $set: {
                        order: index + 1,
                        moduleNumber: index + 1,
                    },
                },
            );
        }

        const updatedModules = await SkillModule.find({})
            .sort({ isActive: -1, order: 1, moduleNumber: 1 })
            .lean();

        return res.json({
            success: true,
            message: 'Modules reordered successfully',
            data: updatedModules.map((module) => sanitizeModuleForResponse(module)),
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Mark module as complete
export const completeModule = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const quizScore = Number(req.body?.quizScore);
        const module = await SkillModule.findById(id);
        if (!module) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Module not found' });
        }

        const progress = await StudentProgress.findOneAndUpdate(
            { userId },
            { $setOnInsert: { userId } },
            { new: true, upsert: true, setDefaultsOnInsert: true },
        );

        const alreadyCompleted = progress.completedModules.some(
            (item) => String(item.moduleId) === String(id),
        );
        if (!alreadyCompleted) {
            progress.completedModules.push({
                moduleId: id,
                completedAt: new Date(),
                quizScore: Number.isFinite(quizScore) ? quizScore : undefined,
            });
            await progress.save();
        }

        let newlyUnlocked = [];
        if (userId) {
            const { checkAchievements } = await import('../services/achievement.service.js');
            newlyUnlocked = await checkAchievements(userId);
        }

        return res.json({
            success: true,
            message: 'Module completed',
            moduleId: id,
            achievements: newlyUnlocked,
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Submit quiz answers
export const submitQuiz = async (req, res) => {
    try {
        const { id } = req.params;
        const { answers } = req.body;

        if (!Array.isArray(answers)) {
            return sendControllerError(req, res, { statusCode: 400, message: 'answers must be an array' });
        }

        const module = await SkillModule.findOne({ _id: id, isActive: true });
        if (!module) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Module not found' });
        }

        const quiz = module.content?.checkpointQuiz || [];
        if (quiz.length === 0) {
            return sendControllerError(req, res, { statusCode: 400, message: 'No quiz available' });
        }

        let correctCount = 0;
        const results = quiz.map((question, index) => {
            const userAnswer = answers[index];
            const isCorrect = userAnswer === question.correctAnswer;
            if (isCorrect) correctCount++;

            return {
                questionIndex: index,
                isCorrect,
                correctAnswer: question.correctAnswer,
                explanation: question.explanation,
            };
        });

        const score = Math.round((correctCount / quiz.length) * 100);
        const passed = score >= PASS_SCORE;

        return res.json({
            success: true,
            score,
            passed,
            totalQuestions: quiz.length,
            correctCount,
            results,
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};
