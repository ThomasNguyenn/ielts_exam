import SkillModule from '../models/SkillModule.model.js';

// Get all skill modules
export const getAllModules = async (req, res) => {
    try {
        const modules = await SkillModule.find({ isActive: true })
            .sort({ moduleNumber: 1, order: 1 })
            .select('-content.checkpointQuiz.correctAnswer') // Hide answers from client
            .lean();

        res.json({ success: true, data: modules });
    } catch (error) {
        console.error('Error fetching modules:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get specific module with full content
export const getModuleById = async (req, res) => {
    try {
        const { id } = req.params;
        const module = await SkillModule.findById(id)
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

// Mark module as complete
export const completeModule = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const module = await SkillModule.findById(id);
        if (!module) {
            return res.status(404).json({ success: false, message: 'Module not found' });
        }

        // Update student progress (we'll implement this in progress controller)
        res.json({
            success: true,
            message: 'Module completed',
            moduleId: id
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
        const { answers } = req.body; // Array of answer indices

        const module = await SkillModule.findById(id);
        if (!module) {
            return res.status(404).json({ success: false, message: 'Module not found' });
        }

        const quiz = module.content.checkpointQuiz;
        if (!quiz || quiz.length === 0) {
            return res.status(400).json({ success: false, message: 'No quiz available' });
        }

        // Grade quiz
        let correctCount = 0;
        const results = quiz.map((question, index) => {
            const userAnswer = answers[index];
            const isCorrect = userAnswer === question.correctAnswer;
            if (isCorrect) correctCount++;

            return {
                questionIndex: index,
                isCorrect,
                correctAnswer: question.correctAnswer,
                explanation: question.explanation
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
            results
        });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
