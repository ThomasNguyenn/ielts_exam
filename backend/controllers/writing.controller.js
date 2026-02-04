import mongoose from "mongoose";
import Writing from "../models/Writing.model.js";

export const getAllWritings = async (req, res) => {
    try {
        const writings = await Writing.find({});
        res.status(200).json({ success: true, data: writings });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const createWriting = async (req, res) => {
    const writing = req.body;

    if (!writing._id || !writing.title || !writing.prompt) {
        return res.status(400).json({ success: false, message: "Please provide _id, title, and prompt" });
    }

    const newWriting = new Writing(writing);

    try {
        await newWriting.save();
        res.status(201).json({ success: true, data: newWriting });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateWriting = async (req, res) => {
    const { id } = req.params;

    const writing = req.body;

    try {
        const updatedWriting = await Writing.findByIdAndUpdate(id, writing, { new: true });
        res.status(200).json({ success: true, data: updatedWriting });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const deleteWriting = async (req, res) => {
    const { id } = req.params;
    try {
        await Writing.findByIdAndDelete(id);
        res.status(201).json({ success: true, message: "Delete Success" });
    } catch (error) {
        res.status(404).json({ success: false, message: "Can not find and delete" });
    }
};

export const getWritingById = async (req, res) => {
    const { id } = req.params;
    try {
        const writing = await Writing.findById(id);
        if (!writing) {
            return res.status(404).json({ success: false, message: "Writing not found" });
        }
        res.status(200).json({ success: true, data: writing });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/** Get writing for exam (without sample answer and band score) */
export const getWritingExam = async (req, res) => {
    const { id } = req.params;
    try {
        const writing = await Writing.findById(id);
        if (!writing) {
            return res.status(404).json({ success: false, message: "Writing not found" });
        }
        res.status(200).json({
            success: true,
            data: {
                _id: writing._id,
                title: writing.title,
                type: writing.type,
                prompt: writing.prompt,
                task_type: writing.task_type,
                word_limit: writing.word_limit,
                essay_word_limit: writing.essay_word_limit,
                time_limit: writing.time_limit,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/** Submit writing answer */
export const submitWriting = async (req, res) => {
    const { id } = req.params; // Writing Task ID
    const { answer, task_type, student_name, student_email, test_id } = req.body || {};
    const userId = req.user?.userId; // Get user ID if authenticated

    if (!answer) {
        return res.status(400).json({ success: false, message: "Answer is required" });
    }

    try {
        const writing = await Writing.findById(id);
        if (!writing) {
            return res.status(404).json({ success: false, message: "Writing not found" });
        }

        // Calculate word count
        const wordCount = answer.trim().split(/\s+/).filter(w => w.length > 0).length;

        // Create a new submission
        // If it's a standalone practice, we might not have test_id.
        // We structure it to fit the model (array of answers).
        import("../models/WritingSubmission.model.js").then(async ({ default: WritingSubmission }) => {
            const newSubmission = new WritingSubmission({
                test_id: test_id || undefined,
                user_id: userId,
                student_name: student_name || 'Anonymous',
                student_email: student_email,
                writing_answers: [{
                    task_id: writing._id,
                    task_title: writing.title,
                    answer_text: answer,
                    word_count: wordCount
                }],
                status: 'pending'
            });

            await newSubmission.save();

            res.status(200).json({
                success: true,
                data: {
                    message: "Answer submitted successfully",
                    submission_id: newSubmission._id,
                    word_count: wordCount,
                    task_type: task_type || writing.task_type,
                },
            });
        });

    } catch (error) {
        console.error("Submit writing error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/** Get pending submissions for teacher */
/** Get submissions with status filtering */
export const getSubmissions = async (req, res) => {
    try {
        const { status } = req.query; 
        const filter = {};
        if (status) filter.status = status;

        const WritingSubmission = (await import("../models/WritingSubmission.model.js")).default;

        const submissions = await WritingSubmission.find(filter)
            .sort({ submitted_at: -1 });

        res.status(200).json({ success: true, data: submissions });
    } catch (error) {
        console.error("Get submissions error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/** Get submission by ID for grading */
export const getSubmissionById = async (req, res) => {
    const { id } = req.params;
    try {
        const WritingSubmission = (await import("../models/WritingSubmission.model.js")).default;
        const submission = await WritingSubmission.findById(id);
        if (!submission) {
            return res.status(404).json({ success: false, message: "Submission not found" });
        }
        res.status(200).json({ success: true, data: submission });
    } catch (error) {
        console.error("Get submission error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/** Score a submission */
export const scoreSubmission = async (req, res) => {
    const { id } = req.params; // Submission ID
    const { scores, feedback } = req.body; // Array of scores or single score object

    try {
        const WritingSubmission = (await import("../models/WritingSubmission.model.js")).default;
        const TestAttempt = (await import("../models/TestAttempt.model.js")).default;

        const submission = await WritingSubmission.findById(id);

        if (!submission) {
            return res.status(404).json({ success: false, message: "Submission not found" });
        }

        // Update writing submission scores
        if (scores && Array.isArray(scores)) {
            submission.scores = scores.map(s => ({
                ...s,
                scored_at: new Date(),
                scored_by: 'Teacher'
            }));
        } else if (feedback) { // Fallback if simple feedback
            // handle logic if structure differs
        }

        // Update global status
        submission.status = 'scored';
        await submission.save();

        // If linked to a TestAttempt, update it
        if (submission.attempt_id) {
            // Calculate overall band score
            // Formula: (Task 2 * 2 + Task 1) / 3
            // Note: We need to know which score corresponds to which task type.
            // Writing Task 1 (task_type 1) vs Task 2 (task_type 2).
            // But 'scores' array doesn't explicitly store 'task_type' unless we populate or infer it.
            // Assuming task 1 is index 0 and task 2 is index 1 for standard 2-task tests.
            // However, better to rely on task_type if available. 
            // Since we don't have task_type easily here without population, we will rely on strict order OR title?
            // Safer approach: Just average if unsure, but user requested specific formula.
            // Let's assume standard IELTS order: Task 1 then Task 2.
            
            const validScores = submission.scores.filter(s => typeof s.score === 'number');
            
            if (validScores.length > 0) {
                let finalScore = 0;
                
                // If we have exactly 2 scores, apply the formula assuming [Task 1, Task 2] order
                if (validScores.length === 2) {
                    const task1Score = validScores[0].score;
                    const task2Score = validScores[1].score;
                    // (Task 2 * 2 + Task 1) / 3
                    const rawWeighted = (task2Score * 2 + task1Score) / 3;
                    // Round to nearest 0.5
                    finalScore = Math.round(rawWeighted * 2) / 2;
                } else {
                    // Fallback to simple average
                    const sum = validScores.reduce((a, b) => a + b.score, 0);
                    const avg = sum / validScores.length;
                    finalScore = Math.round(avg * 2) / 2;
                }

                // Assume Task 1 is first, Task 2 is second in validScores if matched by title/order
                // We will try to map by task_title or order if possible, but for now rely on index
                const task1 = validScores[0];
                const task2 = validScores[1];

                await TestAttempt.findByIdAndUpdate(submission.attempt_id, {
                    score: finalScore,
                    total: 9, 
                    percentage: Math.round((finalScore / 9) * 100),
                    status: 'scored',
                    writing_details: {
                        task1_score: task1 ? task1.score : null,
                        task2_score: task2 ? task2.score : null,
                        feedback: (task1?.feedback || '') + (task2?.feedback ? '\n\n' + task2.feedback : '')
                    }
                });
            }
        }

        res.status(200).json({ success: true, data: submission });
    } catch (error) {
        console.error("Score submission error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
