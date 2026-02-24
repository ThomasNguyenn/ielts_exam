import mongoose from 'mongoose';
import StudyPlan from '../models/StudyPlan.model.js';
import StudyTask from '../models/StudyTask.model.js'; // Legacy collection, kept for migration/cleanup
import StudyTaskProgress from '../models/StudyTaskProgress.model.js';
import StudyTaskHistory from '../models/StudyTaskHistory.model.js';
import Passage from '../models/Passage.model.js';
import Section from '../models/Section.model.js';
import Writing from '../models/Writing.model.js';
import Speaking from '../models/Speaking.model.js';
import Test from '../models/Test.model.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TASK_STATUS = new Set(['pending', 'completed', 'skipped']);
const TASK_TYPES = new Set(['reading_passage', 'vocabulary_set', 'listening_section', 'writing_task', 'speaking_topic']);
const TASK_KEY_SEPARATOR = '|';

const startOfDay = (value) => {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
};

const formatDateKey = (value) => startOfDay(value).toISOString().slice(0, 10);

const parseDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
};

const parseTargetDate = (targetDate) => {
    const parsed = parseDate(targetDate);
    if (!parsed) return null;
    return startOfDay(parsed);
};

const normalizeRef = (value) => {
    if (value === undefined || value === null) return '';
    return String(value);
};

const buildTaskKey = ({ planId, date, type, referenceId }) => {
    return [
        String(planId),
        formatDateKey(date),
        String(type),
        normalizeRef(referenceId)
    ].join(TASK_KEY_SEPARATOR);
};

const parseTaskKey = (taskKey) => {
    if (!taskKey || typeof taskKey !== 'string') return null;
    const parts = taskKey.split(TASK_KEY_SEPARATOR);
    if (parts.length < 4) return null;

    const [planId, dateKey, type, ...rest] = parts;
    const referenceId = rest.join(TASK_KEY_SEPARATOR);
    const date = parseDate(dateKey);
    if (!planId || !date || !type || !referenceId) return null;

    return {
        planId,
        date: startOfDay(date),
        type,
        referenceId
    };
};

const mapTaskToResponse = (task) => ({
    _id: task.taskKey,
    taskKey: task.taskKey,
    planId: task.planId,
    userId: task.userId,
    date: task.date,
    type: task.type,
    referenceId: task.referenceId,
    title: task.title,
    link: task.link,
    status: task.status || 'pending',
    completedAt: task.completedAt || null
});

const getPlanStartDate = (plan) => {
    if (plan?.startDate) return startOfDay(plan.startDate);
    if (plan?.generatedAt) return startOfDay(plan.generatedAt);
    return startOfDay(new Date());
};

const buildLinkMap = (tests) => {
    const linkMap = new Map();

    tests.forEach((test) => {
        if (Array.isArray(test.reading_passages)) {
            test.reading_passages.forEach((pId, index) => {
                const idStr = pId?.toString();
                if (idStr) {
                    linkMap.set(idStr, `/tests/${test._id}/exam?part=${index}&mode=single`);
                }
            });
        }

        if (Array.isArray(test.listening_sections)) {
            test.listening_sections.forEach((sId, index) => {
                const idStr = sId?.toString();
                if (idStr) {
                    linkMap.set(idStr, `/tests/${test._id}/exam?part=${index}&mode=single&type=listening`);
                }
            });
        }
    });

    return linkMap;
};

const createGeneratedTask = ({ planId, userId, date, type, referenceId, title, link = '' }) => {
    const task = {
        planId: String(planId),
        userId: String(userId),
        date: startOfDay(date),
        type,
        referenceId: normalizeRef(referenceId),
        title,
        link
    };
    task.taskKey = buildTaskKey(task);
    task.status = 'pending';
    task.completedAt = null;
    return task;
};

const generateTasksForPlan = async ({ plan, userId }) => {
    const start = getPlanStartDate(plan);
    const end = startOfDay(plan.targetDate);
    if (end < start) return [];

    const [passages, sections, writings, speakings, tests] = await Promise.all([
        Passage.find({}, '_id title').lean(),
        Section.find({}, '_id title').lean(),
        Writing.find({}, '_id title').lean(),
        Speaking.find({}, '_id title').lean(),
        Test.find({}, '_id reading_passages listening_sections').lean()
    ]);

    const linkMap = buildLinkMap(tests);
    const totalDays = Math.floor((end - start) / MS_PER_DAY) + 1;
    const tasks = [];

    let pIdx = 0;
    let sIdx = 0;
    let wIdx = 0;
    let spIdx = 0;

    const pushReadingTask = ({ date }) => {
        if (passages.length === 0) return false;
        const item = passages[pIdx % passages.length];
        const referenceId = item._id.toString();
        const link = linkMap.get(referenceId) || `/practice/${referenceId}`;
        tasks.push(createGeneratedTask({
            planId: plan._id,
            userId,
            date,
            type: 'reading_passage',
            referenceId,
            title: `Reading: ${item.title}`,
            link
        }));
        pIdx++;
        return true;
    };

    const pushListeningTask = ({ date }) => {
        if (sections.length === 0) return false;
        const item = sections[sIdx % sections.length];
        const referenceId = item._id.toString();
        const link = linkMap.get(referenceId) || `/practice/${referenceId}`;
        tasks.push(createGeneratedTask({
            planId: plan._id,
            userId,
            date,
            type: 'listening_section',
            referenceId,
            title: `Listening: ${item.title}`,
            link
        }));
        sIdx++;
        return true;
    };

    const pushWritingTask = ({ date }) => {
        if (writings.length === 0) return false;
        const item = writings[wIdx % writings.length];
        tasks.push(createGeneratedTask({
            planId: plan._id,
            userId,
            date,
            type: 'writing_task',
            referenceId: item._id.toString(),
            title: `Writing: ${item.title}`
        }));
        wIdx++;
        return true;
    };

    const pushSpeakingTask = ({ date }) => {
        if (speakings.length === 0) return false;
        const item = speakings[spIdx % speakings.length];
        tasks.push(createGeneratedTask({
            planId: plan._id,
            userId,
            date,
            type: 'speaking_topic',
            referenceId: item._id.toString(),
            title: `Speaking: ${item.title}`
        }));
        spIdx++;
        return true;
    };

    for (let i = 0; i < totalDays; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const docType = i % 3;

        if (docType === 0) {
            if (!pushReadingTask({ date })) {
                pushListeningTask({ date }) || pushWritingTask({ date }) || pushSpeakingTask({ date });
            }
            continue;
        }

        if (docType === 1) {
            const addedListening = pushListeningTask({ date });
            if (!addedListening) {
                pushReadingTask({ date }) || pushWritingTask({ date }) || pushSpeakingTask({ date });
            } else if (speakings.length > 0) {
                pushSpeakingTask({ date });
            }
            continue;
        }

        if (docType === 2 && !pushWritingTask({ date })) {
            pushReadingTask({ date }) || pushListeningTask({ date }) || pushSpeakingTask({ date });
        }
    }

    return tasks;
};

const applyDateWindow = (tasks, from, to) => {
    if (!from && !to) return tasks;

    const fromDay = from ? startOfDay(from) : null;
    const toDay = to ? startOfDay(to) : null;

    return tasks.filter((task) => {
        const day = startOfDay(task.date);
        if (fromDay && day < fromDay) return false;
        if (toDay && day > toDay) return false;
        return true;
    });
};

const archiveCompletedTasksForPlans = async ({ userId, planIds, reason }) => {
    if (!planIds?.length) return 0;

    const [completedProgress, completedLegacy] = await Promise.all([
        StudyTaskProgress.find({
            userId,
            planId: { $in: planIds },
            status: 'completed'
        }).lean(),
        StudyTask.find({
            userId,
            planId: { $in: planIds },
            status: 'completed'
        }).lean()
    ]);

    const historyDocs = [];
    const seen = new Set();

    const appendHistory = (doc, source = 'progress') => {
        const sourcePlanId = doc.planId || doc.sourcePlanId;
        const completedAt = doc.completedAt ? new Date(doc.completedAt) : new Date();
        const taskKey = doc.taskKey || buildTaskKey({
            planId: sourcePlanId,
            date: doc.date,
            type: doc.type,
            referenceId: doc.referenceId
        });

        const dedupKey = `${sourcePlanId}|${taskKey}|${completedAt.toISOString()}`;
        if (seen.has(dedupKey)) return;
        seen.add(dedupKey);

        historyDocs.push({
            sourcePlanId,
            userId,
            taskKey,
            date: startOfDay(doc.date),
            type: doc.type,
            referenceId: normalizeRef(doc.referenceId),
            title: doc.title,
            link: doc.link || '',
            status: 'completed',
            completedAt,
            archivedAt: new Date(),
            archivedReason: `${reason}:${source}`
        });
    };

    completedProgress.forEach((doc) => appendHistory(doc, 'progress'));
    completedLegacy.forEach((doc) => appendHistory(doc, 'legacy'));

    if (!historyDocs.length) return 0;
    await StudyTaskHistory.insertMany(historyDocs, { ordered: false });
    return historyDocs.length;
};

const deletePlanData = async ({ planIds, deletePlans = true }) => {
    if (!planIds?.length) return;

    await Promise.all([
        StudyTaskProgress.deleteMany({ planId: { $in: planIds } }),
        StudyTask.deleteMany({ planId: { $in: planIds } })
    ]);

    if (deletePlans) {
        await StudyPlan.deleteMany({ _id: { $in: planIds } });
    }
};

const mergeProgressIntoTasks = (tasks, progressDocs) => {
    const progressByKey = new Map(progressDocs.map((doc) => [doc.taskKey, doc]));
    return tasks.map((task) => {
        const matched = progressByKey.get(task.taskKey);
        if (!matched) return mapTaskToResponse(task);

        return mapTaskToResponse({
            ...task,
            status: matched.status || 'pending',
            completedAt: matched.completedAt || null
        });
    });
};

const resolveTaskSnapshot = async ({ taskId, taskPayload, userId, plan }) => {
    if (taskPayload && typeof taskPayload === 'object') {
        const parsedDate = parseDate(taskPayload.date);
        if (!parsedDate) return null;
        if (!TASK_TYPES.has(taskPayload.type)) return null;

        const snapshot = {
            planId: String(plan._id),
            userId: String(userId),
            date: startOfDay(parsedDate),
            type: taskPayload.type,
            referenceId: normalizeRef(taskPayload.referenceId),
            title: taskPayload.title || `${taskPayload.type}: ${normalizeRef(taskPayload.referenceId)}`,
            link: taskPayload.link || ''
        };
        snapshot.taskKey = buildTaskKey(snapshot);
        return snapshot;
    }

    const candidateId = taskId || '';

    const existingProgress = await StudyTaskProgress.findOne({
        userId,
        planId: plan._id,
        taskKey: candidateId
    }).lean();

    if (existingProgress) {
        return {
            planId: String(existingProgress.planId),
            userId: String(existingProgress.userId),
            date: existingProgress.date,
            type: existingProgress.type,
            referenceId: normalizeRef(existingProgress.referenceId),
            title: existingProgress.title,
            link: existingProgress.link || '',
            taskKey: existingProgress.taskKey
        };
    }

    if (mongoose.Types.ObjectId.isValid(candidateId)) {
        const legacyTask = await StudyTask.findOne({
            _id: candidateId,
            userId,
            planId: plan._id
        }).lean();

        if (legacyTask) {
            const snapshot = {
                planId: String(plan._id),
                userId: String(userId),
                date: startOfDay(legacyTask.date),
                type: legacyTask.type,
                referenceId: normalizeRef(legacyTask.referenceId),
                title: legacyTask.title,
                link: legacyTask.link || ''
            };
            snapshot.taskKey = buildTaskKey(snapshot);
            return snapshot;
        }
    }

    const parsedKey = parseTaskKey(candidateId);
    if (!parsedKey || parsedKey.planId !== String(plan._id)) return null;

    const generatedTasks = await generateTasksForPlan({ plan, userId });
    const task = generatedTasks.find((item) => item.taskKey === candidateId);
    if (!task) return null;
    return task;
};

// 1. Create a new Study Plan
export const createStudyPlan = async (req, res) => {
    try {
        const { targetDate, targetBand } = req.body;
        const userId = req.user.userId;

        if (!targetDate || targetBand === undefined || targetBand === null) {
            return sendControllerError(req, res, { statusCode: 400, message: 'Missing targetDate or targetBand'  });
        }

        const parsedTargetDate = parseTargetDate(targetDate);
        if (!parsedTargetDate) {
            return sendControllerError(req, res, { statusCode: 400, message: 'Invalid targetDate'  });
        }

        const today = startOfDay(new Date());
        if (parsedTargetDate < today) {
            return sendControllerError(req, res, { statusCode: 400, message: 'targetDate must be today or in the future'  });
        }

        const existingPlans = await StudyPlan.find({ userId }, '_id').lean();
        const existingPlanIds = existingPlans.map((p) => p._id);

        if (existingPlanIds.length > 0) {
            await archiveCompletedTasksForPlans({
                userId,
                planIds: existingPlanIds,
                reason: 'plan_replaced_create'
            });
            await deletePlanData({ planIds: existingPlanIds, deletePlans: true });
        }

        const newPlan = new StudyPlan({
            userId,
            targetDate: parsedTargetDate,
            targetBand,
            startDate: today,
            generationVersion: 1,
            generatedAt: new Date(),
            isActive: true
        });

        await newPlan.save();

        const generatedTasks = await generateTasksForPlan({ plan: newPlan, userId });
        res.status(201).json({
            success: true,
            message: 'Study Plan Created',
            plan: newPlan,
            tasksCount: generatedTasks.length
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// 2. Get My Plan (generated roadmap + sparse progress overlay)
export const getMyPlan = async (req, res) => {
    try {
        const userId = req.user.userId;
        const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
        const from = req.query.from ? parseDate(req.query.from) : null;
        const to = req.query.to ? parseDate(req.query.to) : null;

        if (req.query.from && !from) {
            return sendControllerError(req, res, { statusCode: 400, message: 'Invalid from date'  });
        }
        if (req.query.to && !to) {
            return sendControllerError(req, res, { statusCode: 400, message: 'Invalid to date'  });
        }

        const plan = await StudyPlan.findOne({ userId, isActive: true });
        if (!plan) {
            return res.json({ success: true, plan: null, tasks: [] });
        }

        const generatedTasks = await generateTasksForPlan({ plan, userId });
        const visibleTasks = applyDateWindow(generatedTasks, from, to);

        const progressQuery = { userId, planId: plan._id };
        const dateQuery = {};
        if (from) dateQuery.$gte = startOfDay(from);
        if (to) dateQuery.$lte = startOfDay(to);
        if (Object.keys(dateQuery).length > 0) {
            progressQuery.date = dateQuery;
        }

        const progressDocs = await StudyTaskProgress.find(progressQuery).lean();
        const tasks = mergeProgressIntoTasks(visibleTasks, progressDocs).sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );

        if (shouldPaginate) {
            const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30, maxLimit: 200 });
            const totalItems = tasks.length;
            const paginatedTasks = tasks.slice(skip, skip + limit);
            return res.json({
                success: true,
                plan,
                tasks: paginatedTasks,
                pagination: buildPaginationMeta({ page, limit, totalItems })
            });
        }

        res.json({ success: true, plan, tasks });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// 3. Update Task Status (sparse progress)
export const updateTaskStatus = async (req, res) => {
    try {
        const taskId = req.params.id ? decodeURIComponent(req.params.id) : '';
        const { status, task } = req.body;
        const userId = req.user.userId;

        if (!TASK_STATUS.has(status)) {
            return sendControllerError(req, res, { statusCode: 400, message: 'Invalid status value'  });
        }

        const plan = await StudyPlan.findOne({ userId, isActive: true });
        if (!plan) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Active plan not found'  });
        }

        const taskSnapshot = await resolveTaskSnapshot({
            taskId,
            taskPayload: task,
            userId,
            plan
        });

        if (!taskSnapshot) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Task not found in current roadmap'  });
        }

        if (status === 'pending') {
            await StudyTaskProgress.deleteOne({
                userId,
                planId: plan._id,
                taskKey: taskSnapshot.taskKey
            });

            return res.json({
                success: true,
                message: 'Task updated',
                task: mapTaskToResponse({
                    ...taskSnapshot,
                    status: 'pending',
                    completedAt: null
                })
            });
        }

        const updateDoc = {
            planId: plan._id,
            userId,
            taskKey: taskSnapshot.taskKey,
            date: startOfDay(taskSnapshot.date),
            type: taskSnapshot.type,
            referenceId: normalizeRef(taskSnapshot.referenceId),
            title: taskSnapshot.title,
            link: taskSnapshot.link || '',
            status,
            completedAt: status === 'completed' ? new Date() : null
        };

        const progress = await StudyTaskProgress.findOneAndUpdate(
            { userId, planId: plan._id, taskKey: taskSnapshot.taskKey },
            { $set: updateDoc },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();

        res.json({
            success: true,
            message: 'Task updated',
            task: mapTaskToResponse(progress)
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const updateStudyPlan = async (req, res) => {
    try {
        const { targetDate, targetBand } = req.body;
        const userId = req.user.userId;

        if (!targetDate || targetBand === undefined || targetBand === null) {
            return sendControllerError(req, res, { statusCode: 400, message: 'Missing targetDate or targetBand'  });
        }

        const parsedTargetDate = parseTargetDate(targetDate);
        if (!parsedTargetDate) {
            return sendControllerError(req, res, { statusCode: 400, message: 'Invalid targetDate'  });
        }

        const today = startOfDay(new Date());
        if (parsedTargetDate < today) {
            return sendControllerError(req, res, { statusCode: 400, message: 'targetDate must be today or in the future'  });
        }

        const plan = await StudyPlan.findOne({ userId, isActive: true });
        if (!plan) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Active plan not found'  });
        }

        // Archive completed tasks from active plan before resetting roadmap.
        await archiveCompletedTasksForPlans({
            userId,
            planIds: [plan._id],
            reason: 'plan_updated_active'
        });

        // Remove any stale duplicate plans/tasks from legacy behavior.
        const stalePlans = await StudyPlan.find(
            { userId, _id: { $ne: plan._id } },
            '_id'
        ).lean();
        const stalePlanIds = stalePlans.map((p) => p._id);
        if (stalePlanIds.length > 0) {
            await archiveCompletedTasksForPlans({
                userId,
                planIds: stalePlanIds,
                reason: 'plan_updated_cleanup'
            });
            await deletePlanData({ planIds: stalePlanIds, deletePlans: true });
        }

        // Reset active plan state (sparse progress) and regenerate from today.
        await deletePlanData({ planIds: [plan._id], deletePlans: false });

        plan.targetDate = parsedTargetDate;
        plan.targetBand = targetBand;
        plan.startDate = today;
        plan.generationVersion = (plan.generationVersion || 1) + 1;
        plan.generatedAt = new Date();
        plan.isActive = true;
        await plan.save();

        const generatedTasks = await generateTasksForPlan({ plan, userId });
        res.json({
            success: true,
            plan,
            message: 'Plan updated',
            tasksCount: generatedTasks.length
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const getStudyHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
        const [archivedHistory, completedProgress, completedLegacy] = await Promise.all([
            StudyTaskHistory.find({ userId, status: 'completed' }).sort({ completedAt: -1 }).lean(),
            StudyTaskProgress.find({
                userId,
                status: 'completed'
            }).lean(),
            StudyTask.find({
                userId,
                status: 'completed'
            }).lean()
        ]);

        const liveCompleted = [
            ...completedProgress.map((doc) => mapTaskToResponse(doc)),
            ...completedLegacy.map((doc) => {
                const snapshot = {
                    planId: String(doc.planId),
                    userId: String(doc.userId),
                    date: doc.date,
                    type: doc.type,
                    referenceId: normalizeRef(doc.referenceId),
                    title: doc.title,
                    link: doc.link || '',
                    status: 'completed',
                    completedAt: doc.completedAt || null
                };
                snapshot.taskKey = buildTaskKey(snapshot);
                return mapTaskToResponse(snapshot);
            })
        ];

        const archived = archivedHistory.map((doc) => ({
            _id: doc._id,
            taskKey: doc.taskKey || null,
            sourcePlanId: doc.sourcePlanId || null,
            date: doc.date,
            type: doc.type,
            referenceId: doc.referenceId,
            title: doc.title,
            link: doc.link,
            status: doc.status,
            completedAt: doc.completedAt || null,
            archivedAt: doc.archivedAt || null
        }));

        const deduped = [];
        const seen = new Set();
        [...liveCompleted, ...archived].forEach((task) => {
            const completedAt = task.completedAt ? new Date(task.completedAt).toISOString() : '';
            const key = `${task.taskKey || task._id}|${completedAt}|${task.title}`;
            if (seen.has(key)) return;
            seen.add(key);
            deduped.push(task);
        });

        const tasks = deduped.sort(
            (a, b) => new Date(b.completedAt || b.date) - new Date(a.completedAt || a.date)
        );

        if (shouldPaginate) {
            const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30, maxLimit: 200 });
            const totalItems = tasks.length;
            const paginatedTasks = tasks.slice(skip, skip + limit);
            return res.json({
                success: true,
                tasks: paginatedTasks,
                pagination: buildPaginationMeta({ page, limit, totalItems })
            });
        }

        res.json({ success: true, tasks });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};


