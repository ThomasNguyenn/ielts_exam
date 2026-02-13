import StudyPlan from '../models/StudyPlan.model.js';
import StudyTask from '../models/StudyTask.model.js';
import Passage from '../models/Passage.model.js';
import Section from '../models/Section.model.js';
import Writing from '../models/Writing.model.js'; // Assuming you have this
import Speaking from '../models/Speaking.model.js'; // Assuming you have this or similar

// 1. Create a new Study Plan
export const createStudyPlan = async (req, res) => {
    try {
        const { targetDate, targetBand } = req.body;
        const userId = req.user.userId; // Ensure this comes from auth middleware

        // Validate
        if (!targetDate || !targetBand) {
            return res.status(400).json({ message: "Missing targetDate or targetBand" });
        }

        // Deactivate old plans
        await StudyPlan.updateMany({ userId, isActive: true }, { isActive: false });

        // Create new plan
        const newPlan = new StudyPlan({
            userId,
            targetDate: new Date(targetDate),
            targetBand,
            isActive: true
        });

        await newPlan.save();

        // GENERATE TASKS (Simple Algorithm)
        // Calculate days remaining
        const now = new Date();
        const end = new Date(targetDate);
        const diffTime = Math.abs(end - now);
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Example: Generate 1 task per day for now
        // In real app, you'd use a smarter algorithm based on weak skills.

        const start = new Date(); // Start today

        // Fetch Content Pool (Limit to prevent massive memory usage, or just select IDs)
        // ideally we fetch IDs only.
        const passages = await Passage.find({}, '_id title');
        const sections = await Section.find({}, '_id title');
        const writings = await Writing.find({}, '_id title');
        const speakings = await Speaking.find({}, '_id title');

        // Fetch Tests to map content to Test ID (for correct linking)
        // We need to know which Test a passage/section/writing belongs to.
        const tests = await import('../models/Test.model.js').then(m => m.default.find({}, '_id reading_passages listening_sections writing_tasks'));

        // Build efficient lookup map: ContentID -> Link
        const linkMap = new Map();

        // console.log(`[CreatePlan] Found ${tests.length} tests. Building LinkMap...`);

        tests.forEach(test => {
            // Reading Passages
            if (test.reading_passages && Array.isArray(test.reading_passages)) {
                test.reading_passages.forEach((pId, index) => {
                    // Check if pId is object or string to avoid [object Object]
                    const idStr = (pId && pId._id) ? pId._id.toString() : pId.toString();
                    linkMap.set(idStr, `/tests/${test._id}/exam?part=${index + 1}&mode=single`);
                });
            }
            // Listening Sections
            if (test.listening_sections && Array.isArray(test.listening_sections)) {
                test.listening_sections.forEach((sId, index) => {
                    const idStr = (sId && sId._id) ? sId._id.toString() : sId.toString();
                    linkMap.set(idStr, `/tests/${test._id}/exam?part=${index + 1}&mode=single&type=listening`);
                });
            }
            // Writing Tasks
            if (test.writing_tasks && Array.isArray(test.writing_tasks)) {
                test.writing_tasks.forEach((wId, index) => {
                    // Writing might be different. 
                    // If writing is part of a test, maybe /tests/:testId/writing?part=...
                    const idStr = (wId && wId._id) ? wId._id.toString() : wId.toString();
                    // linkMap.set(idStr, ...); // Implement if needed
                });
            }
        });
        // console.log(`[CreatePlan] LinkMap size: ${linkMap.size}`);

        const tasks = [];
        let pIdx = 0, sIdx = 0, wIdx = 0, spIdx = 0;

        for (let i = 0; i < days; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i + 1); // Start from tomorrow? or today? Let's say today + 1 for preparation. Or just i if we start today.
            // Let's start from today if it's early, or tomorrow. Simple: start today.
            // Actually, keep currentDate as loop var.
            const d = new Date(start);
            d.setDate(d.getDate() + i);

            // Simple Strategy:
            // Day 1: Reading + Vocabulary
            // Day 2: Listening + Speaking
            // Day 3: Writing
            // Repeat.

            const docType = i % 3; // 0, 1, 2

            if (docType === 0 && passages.length > 0) {
                // Reading
                const item = passages[pIdx % passages.length];
                const link = linkMap.get(item._id.toString()) || `/practice/${item._id}`;
                tasks.push({
                    planId: newPlan._id,
                    userId,
                    date: d,
                    type: 'reading_passage',
                    referenceId: item._id,
                    title: `Reading: ${item.title}`,
                    link: link
                });
                pIdx++;
            } else if (docType === 1 && sections.length > 0) {
                // Listening + Speaking
                const itemL = sections[sIdx % sections.length];
                const linkL = linkMap.get(itemL._id.toString()) || `/practice/${itemL._id}`;
                tasks.push({
                    planId: newPlan._id,
                    userId,
                    date: d,
                    type: 'listening_section',
                    referenceId: itemL._id,
                    title: `Listening: ${itemL.title}`,
                    link: linkL
                });
                sIdx++;

                // Speaking
                if (speakings.length > 0) {
                    const itemS = speakings[spIdx % speakings.length];
                    tasks.push({
                        planId: newPlan._id,
                        userId,
                        date: d,
                        type: 'speaking_topic',
                        referenceId: itemS._id,
                        title: `Speaking: ${itemS.title}`
                    });
                    spIdx++;
                }

            } else if (docType === 2) {
                // Writing
                if (writings.length > 0) {
                    const itemW = writings[wIdx % writings.length];
                    tasks.push({
                        planId: newPlan._id,
                        userId,
                        date: d,
                        type: 'writing_task',
                        referenceId: itemW._id,
                        title: `Writing: ${itemW.title}`
                    });
                    wIdx++;
                }
            }
        }

        await StudyTask.insertMany(tasks);

        res.status(201).json({ message: "Study Plan Created", plan: newPlan, tasksCount: tasks.length });
    } catch (error) {
        // console.error("Create Plan Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// 2. Get My Plan
export const getMyPlan = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Find active plan
        const plan = await StudyPlan.findOne({ userId, isActive: true });

        if (!plan) {
            return res.json({ plan: null });
        }

        // Find tasks for this plan
        // Sort by date ascending
        const tasks = await StudyTask.find({ planId: plan._id }).sort({ date: 1 });

        res.json({ plan, tasks });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Update Task Status
export const updateTaskStatus = async (req, res) => {
    try {
        const taskId = req.params.id;
        const { status } = req.body; // 'completed', 'pending', 'skipped'
        const userId = req.user.userId;

        const task = await StudyTask.findOne({ _id: taskId, userId });
        if (!task) return res.status(404).json({ message: "Task not found" });

        task.status = status;
        if (status === 'completed') {
            task.completedAt = new Date();
        } else {
            task.completedAt = null;
        }

        await task.save();
        res.json({ message: "Task updated", task });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateStudyPlan = async (req, res) => {
    try {
        const { targetDate, targetBand } = req.body;
        const userId = req.user.userId;

        const plan = await StudyPlan.findOneAndUpdate(
            { userId, isActive: true },
            { targetDate: new Date(targetDate), targetBand },
            { new: true }
        );

        if (!plan) return res.status(404).json({ message: "Active plan not found" });

        res.json({ plan, message: "Plan updated" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getStudyHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const tasks = await StudyTask.find({ userId, status: 'completed' })
            .sort({ completedAt: -1 });

        res.json({ tasks });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
