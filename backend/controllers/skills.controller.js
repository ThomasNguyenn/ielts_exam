import SkillModule from '../models/SkillModule.model.js';

const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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

const buildContentPayload = (content = {}, isUpdate = false) => {
    const payload = {};

    if (!isUpdate || Object.prototype.hasOwnProperty.call(content, 'lesson')) {
        payload.lesson = String(content.lesson ?? '').trim();
    }
    if (!isUpdate || Object.prototype.hasOwnProperty.call(content, 'videoUrl')) {
        payload.videoUrl = String(content.videoUrl ?? '').trim();
    }
    if (!isUpdate || Object.prototype.hasOwnProperty.call(content, 'examples')) {
        payload.examples = toStringArray(content.examples);
    }
    if (!isUpdate || Object.prototype.hasOwnProperty.call(content, 'keyPoints')) {
        payload.keyPoints = toStringArray(content.keyPoints);
    }
    if (!isUpdate || Object.prototype.hasOwnProperty.call(content, 'resources')) {
        payload.resources = toResources(content.resources);
    }
    if (!isUpdate || Object.prototype.hasOwnProperty.call(content, 'checkpointQuiz')) {
        payload.checkpointQuiz = toCheckpointQuiz(content.checkpointQuiz);
    }

    return payload;
};

const buildModulePayload = (body = {}, isUpdate = false) => {
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(body, 'moduleNumber')) {
        payload.moduleNumber = Math.max(1, toNumber(body.moduleNumber, 1));
    }
    if (!isUpdate || Object.prototype.hasOwnProperty.call(body, 'title')) {
        payload.title = String(body.title ?? '').trim();
    }
    if (!isUpdate || Object.prototype.hasOwnProperty.call(body, 'description')) {
        payload.description = String(body.description ?? '').trim();
    }
    if (!isUpdate || Object.prototype.hasOwnProperty.call(body, 'estimatedMinutes')) {
        payload.estimatedMinutes = Math.max(1, toNumber(body.estimatedMinutes, 10));
    }
    if (!isUpdate || Object.prototype.hasOwnProperty.call(body, 'icon')) {
        payload.icon = String(body.icon ?? '📚').trim() || '📚';
    }
    if (Object.prototype.hasOwnProperty.call(body, 'order')) {
        payload.order = Math.max(1, toNumber(body.order, 1));
    }
    if (!isUpdate) {
        payload.isActive = Object.prototype.hasOwnProperty.call(body, 'isActive') ? Boolean(body.isActive) : true;
    } else if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
        payload.isActive = Boolean(body.isActive);
    }

    if (!isUpdate || Object.prototype.hasOwnProperty.call(body, 'content')) {
        payload.content = buildContentPayload(body.content || {}, isUpdate);
    }

    if (!isUpdate || Object.prototype.hasOwnProperty.call(body, 'unlockRequirement')) {
        const unlockRequirement = body.unlockRequirement || {};
        payload.unlockRequirement = {
            previousModule: unlockRequirement.previousModule || undefined,
            minimumScore: Math.max(1, Math.min(100, toNumber(unlockRequirement.minimumScore, 70))),
        };
    }

    return payload;
};

const syncModuleOrderAndPrerequisites = async () => {
    const modules = await SkillModule.find({ isActive: true })
        .sort({ order: 1, moduleNumber: 1, createdAt: 1 });

    for (let index = 0; index < modules.length; index++) {
        const module = modules[index];
        const expectedOrder = index + 1;
        const previousModule = index > 0 ? modules[index - 1]._id : null;

        const setOps = {};
        const unsetOps = {};

        if (module.order !== expectedOrder) setOps.order = expectedOrder;
        if (module.moduleNumber !== expectedOrder) setOps.moduleNumber = expectedOrder;

        if (previousModule) {
            if (String(module.unlockRequirement?.previousModule || '') !== String(previousModule)) {
                setOps['unlockRequirement.previousModule'] = previousModule;
            }
        } else if (module.unlockRequirement?.previousModule) {
            unsetOps['unlockRequirement.previousModule'] = 1;
        }

        if (Object.keys(setOps).length > 0 || Object.keys(unsetOps).length > 0) {
            await SkillModule.updateOne(
                { _id: module._id },
                {
                    ...(Object.keys(setOps).length > 0 ? { $set: setOps } : {}),
                    ...(Object.keys(unsetOps).length > 0 ? { $unset: unsetOps } : {}),
                },
            );
        }
    }
};

// Student: Get all active modules without answer keys
export const getAllModules = async (req, res) => {
    try {
        const modules = await SkillModule.find({ isActive: true })
            .sort({ order: 1, moduleNumber: 1 })
            .select('-content.checkpointQuiz.correctAnswer')
            .lean();

        res.json({ success: true, data: modules });
    } catch (error) {
        console.error('Error fetching modules:', error);
        res.status(500).json({ success: false, message: error.message });
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
            return res.status(404).json({ success: false, message: 'Module not found' });
        }

        res.json({ success: true, data: module });
    } catch (error) {
        console.error('Error fetching module:', error);
        res.status(500).json({ success: false, message: error.message });
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

        res.json({ success: true, data: modules });
    } catch (error) {
        console.error('Error fetching modules for management:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Teacher/Admin: Get one module with full data
export const getModuleByIdForManage = async (req, res) => {
    try {
        const { id } = req.params;
        const module = await SkillModule.findById(id).lean();

        if (!module) {
            return res.status(404).json({ success: false, message: 'Module not found' });
        }

        res.json({ success: true, data: module });
    } catch (error) {
        console.error('Error fetching module for management:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Teacher/Admin: Create module
export const createModule = async (req, res) => {
    try {
        const payload = buildModulePayload(req.body, false);

        if (!payload.title || !payload.description || !payload.content?.lesson) {
            return res.status(400).json({
                success: false,
                message: 'title, description, and content.lesson are required',
            });
        }

        const maxOrderModule = await SkillModule.findOne({}).sort({ order: -1 }).select('order').lean();
        const nextOrder = (maxOrderModule?.order || 0) + 1;
        payload.order = payload.order || nextOrder;
        payload.moduleNumber = payload.moduleNumber || payload.order;

        const created = await SkillModule.create(payload);
        await syncModuleOrderAndPrerequisites();

        const saved = await SkillModule.findById(created._id).lean();
        res.status(201).json({ success: true, data: saved });
    } catch (error) {
        console.error('Error creating module:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Teacher/Admin: Update module
export const updateModule = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = buildModulePayload(req.body, true);

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ success: false, message: 'No updates provided' });
        }

        if (payload.content && Object.prototype.hasOwnProperty.call(payload.content, 'lesson') && !payload.content.lesson) {
            return res.status(400).json({ success: false, message: 'content.lesson cannot be empty' });
        }

        const updated = await SkillModule.findByIdAndUpdate(id, payload, {
            new: true,
            runValidators: true,
        });

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Module not found' });
        }

        await syncModuleOrderAndPrerequisites();
        const refreshed = await SkillModule.findById(id).lean();

        res.json({ success: true, data: refreshed });
    } catch (error) {
        console.error('Error updating module:', error);
        res.status(500).json({ success: false, message: error.message });
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
            return res.status(404).json({ success: false, message: 'Module not found' });
        }

        await syncModuleOrderAndPrerequisites();
        res.json({ success: true, message: 'Module disabled successfully' });
    } catch (error) {
        console.error('Error deleting module:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Teacher/Admin: Reorder active modules with explicit sequence
export const reorderModules = async (req, res) => {
    try {
        const moduleIds = Array.isArray(req.body?.moduleIds)
            ? req.body.moduleIds.map((id) => String(id))
            : [];

        if (moduleIds.length === 0) {
            return res.status(400).json({ success: false, message: 'moduleIds must be a non-empty array' });
        }

        const uniqueIds = [...new Set(moduleIds)];
        if (uniqueIds.length !== moduleIds.length) {
            return res.status(400).json({ success: false, message: 'moduleIds contains duplicates' });
        }

        const activeModules = await SkillModule.find({ isActive: true }).select('_id').lean();
        const activeIds = activeModules.map((module) => String(module._id));

        if (activeIds.length !== moduleIds.length) {
            return res.status(400).json({
                success: false,
                message: 'moduleIds must include all active modules exactly once',
            });
        }

        const incomingSet = new Set(moduleIds);
        const isExactMatch = activeIds.every((id) => incomingSet.has(id));
        if (!isExactMatch) {
            return res.status(400).json({
                success: false,
                message: 'moduleIds must match active module ids',
            });
        }

        for (let index = 0; index < moduleIds.length; index++) {
            const id = moduleIds[index];
            const previousId = index > 0 ? moduleIds[index - 1] : null;

            await SkillModule.updateOne(
                { _id: id },
                {
                    $set: {
                        order: index + 1,
                        moduleNumber: index + 1,
                        ...(previousId ? { 'unlockRequirement.previousModule': previousId } : {}),
                    },
                    ...(previousId ? {} : { $unset: { 'unlockRequirement.previousModule': 1 } }),
                },
            );
        }

        const updatedModules = await SkillModule.find({})
            .sort({ isActive: -1, order: 1, moduleNumber: 1 })
            .lean();

        return res.json({
            success: true,
            message: 'Modules reordered successfully',
            data: updatedModules,
        });
    } catch (error) {
        console.error('Error reordering modules:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Mark module as complete
export const completeModule = async (req, res) => {
    try {
        const { id } = req.params;
        const module = await SkillModule.findById(id);
        if (!module) {
            return res.status(404).json({ success: false, message: 'Module not found' });
        }

        res.json({
            success: true,
            message: 'Module completed',
            moduleId: id,
        });
    } catch (error) {
        console.error('Error completing module:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Submit quiz answers
export const submitQuiz = async (req, res) => {
    try {
        const { id } = req.params;
        const { answers } = req.body;

        if (!Array.isArray(answers)) {
            return res.status(400).json({ success: false, message: 'answers must be an array' });
        }

        const module = await SkillModule.findOne({ _id: id, isActive: true });
        if (!module) {
            return res.status(404).json({ success: false, message: 'Module not found' });
        }

        const quiz = module.content?.checkpointQuiz || [];
        if (quiz.length === 0) {
            return res.status(400).json({ success: false, message: 'No quiz available' });
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
        const passed = score >= (module.unlockRequirement?.minimumScore || 70);

        res.json({
            success: true,
            score,
            passed,
            totalQuestions: quiz.length,
            correctCount,
            results,
        });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
