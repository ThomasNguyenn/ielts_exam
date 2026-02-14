import ModelEssay from '../models/ModelEssay.model.js';

// Get model essays with filters
export const getModelEssays = async (req, res) => {
    try {
        const { questionType, taskType, bandScore, difficulty, limit = 10 } = req.query;

        const query = { isActive: true };

        if (questionType) query.questionType = questionType;
        if (taskType) query.taskType = taskType;
        if (bandScore) query.bandScore = { $gte: parseFloat(bandScore) };
        if (difficulty) query.difficulty = difficulty;

        const essays = await ModelEssay.find(query)
            .select('-annotations -comparisonEssay') // Don't send full annotations in list view
            .limit(parseInt(limit))
            .sort({ bandScore: -1, createdAt: -1 })
            .lean();

        res.json({ success: true, data: essays });
    } catch (error) {
        console.error('Error fetching model essays:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get specific model essay with annotations
export const getModelEssayById = async (req, res) => {
    try {
        const { id } = req.params;

        const essay = await ModelEssay.findById(id).lean();

        if (!essay) {
            return res.status(404).json({ success: false, message: 'Model essay not found' });
        }

        res.json({ success: true, data: essay });
    } catch (error) {
        console.error('Error fetching model essay:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Submit analysis task (for Phase 3)
export const submitAnalysisTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { taskType, answer } = req.body;

        const essay = await ModelEssay.findById(id);
        if (!essay) {
            return res.status(404).json({ success: false, message: 'Model essay not found' });
        }

        // Simple validation based on task type
        let isCorrect = false;
        let feedback = '';

        switch (taskType) {
            case 'identify_thesis':
                // Check if user selected the correct annotation
                const thesisAnnotation = essay.annotations.find(a => a.type === 'thesis');
                if (thesisAnnotation && answer.includes(thesisAnnotation.text)) {
                    isCorrect = true;
                    feedback = 'Correct! You identified the thesis statement.';
                } else {
                    feedback = `The thesis statement is: "${thesisAnnotation?.text}"`;
                }
                break;

            case 'count_main_ideas':
                const topicSentenceCount = essay.annotations.filter(a => a.type === 'topic_sentence').length;
                isCorrect = parseInt(answer) === topicSentenceCount;
                feedback = isCorrect
                    ? 'Correct! You counted the main ideas accurately.'
                    : `There are ${topicSentenceCount} main ideas in this essay.`;
                break;

            case 'find_cohesive_devices':
                const cohesiveDevices = essay.annotations.filter(a => a.type === 'cohesive_device' || a.type === 'linking_phrase');
                isCorrect = answer.length >= 3;
                feedback = isCorrect
                    ? 'Good job! You identified cohesive devices.'
                    : `Look for words like: ${cohesiveDevices.slice(0, 3).map(a => a.text).join(', ')}`;
                break;

            default:
                feedback = 'Task submitted successfully';
        }

        res.json({
            success: true,
            isCorrect,
            feedback,
            details: taskType === 'find_cohesive_devices' ? {
                exampleDevices: essay.annotations
                    .filter(a => a.type === 'cohesive_device' || a.type === 'linking_phrase')
                    .map(a => ({ text: a.text, explanation: a.explanation }))
            } : null
        });
    } catch (error) {
        console.error('Error submitting analysis task:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
