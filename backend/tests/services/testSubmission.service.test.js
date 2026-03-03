import { describe, expect, it } from "vitest";
import {
    gradeExam,
    validateSubmissionPayload,
} from "../../services/testSubmission.service.js";

describe("testSubmission.service validateSubmissionPayload", () => {
    it("throws when answers is not an array for non-writing exams", () => {
        expect(() =>
            validateSubmissionPayload({
                examType: "reading",
                answers: "A",
                writing: [],
            }),
        ).toThrow("answers must be an array");
    });

    it("allows missing answers array for writing exam", () => {
        const payload = validateSubmissionPayload({
            examType: "writing",
            answers: null,
            writing: ["Task answer"],
        });

        expect(payload.safeAnswers).toEqual([]);
        expect(payload.safeWriting).toEqual(["Task answer"]);
    });
});

describe("testSubmission.service gradeExam", () => {
    it("grades mult_choice groups order-independently with label/text aliases and no double-counting", () => {
        const test = {
            type: "reading",
            reading_passages: [
                {
                    question_groups: [
                        {
                            type: "mult_choice",
                            questions: [
                                {
                                    q_number: 1,
                                    text: "Q1",
                                    correct_answers: ["A"],
                                    option: [
                                        { label: "A", text: "Apple" },
                                        { label: "B", text: "Banana" },
                                        { label: "C", text: "Cherry" },
                                    ],
                                },
                                {
                                    q_number: 2,
                                    text: "Q2",
                                    correct_answers: ["C"],
                                    option: [
                                        { label: "A", text: "Apple" },
                                        { label: "B", text: "Banana" },
                                        { label: "C", text: "Cherry" },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
            listening_sections: [],
        };

        const swapped = gradeExam({
            test,
            examType: "reading",
            safeAnswers: ["Cherry", "Apple"],
        });
        const duplicated = gradeExam({
            test,
            examType: "reading",
            safeAnswers: ["Apple", "Apple"],
        });

        expect(swapped.score).toBe(2);
        expect(swapped.total).toBe(2);
        expect(duplicated.score).toBe(1);
    });

    it("accepts matching heading by selected heading id when correct answer stores heading text", () => {
        const test = {
            type: "reading",
            reading_passages: [
                {
                    question_groups: [
                        {
                            type: "matching_headings",
                            headings: [
                                { id: "I", text: "Early Growth" },
                                { id: "II", text: "Rapid Decline" },
                            ],
                            questions: [
                                {
                                    q_number: 1,
                                    text: "Pick heading",
                                    correct_answers: ["Rapid Decline"],
                                },
                            ],
                        },
                    ],
                },
            ],
            listening_sections: [],
        };

        const result = gradeExam({
            test,
            examType: "reading",
            safeAnswers: ["II"],
        });

        expect(result.score).toBe(1);
        expect(result.questionReview[0].is_correct).toBe(true);
    });

    it("accepts label/id/text aliases for completion option pools", () => {
        const test = {
            type: "listening",
            reading_passages: [],
            listening_sections: [
                {
                    question_groups: [
                        {
                            type: "summary_completion",
                            options: [
                                { id: "A", text: "volcanic ash" },
                                { id: "B", text: "marine clay" },
                            ],
                            questions: [
                                { q_number: 1, text: "Q1", correct_answers: ["A"] },
                                { q_number: 2, text: "Q2", correct_answers: ["marine clay"] },
                            ],
                        },
                    ],
                },
            ],
        };

        const result = gradeExam({
            test,
            examType: "listening",
            safeAnswers: ["volcanic ash", "B"],
        });

        expect(result.score).toBe(2);
        expect(result.questionReview[0].is_correct).toBe(true);
        expect(result.questionReview[1].is_correct).toBe(true);
    });

    it("scores summary_completion without options like note completion (direct text answer)", () => {
        const test = {
            type: "reading",
            reading_passages: [
                {
                    question_groups: [
                        {
                            type: "summary_completion",
                            options: [],
                            questions: [
                                { q_number: 1, text: "Q1", correct_answers: ["volcanic ash"] },
                                { q_number: 2, text: "Q2", correct_answers: ["marine clay"] },
                            ],
                        },
                        {
                            type: "note_completion",
                            questions: [
                                { q_number: 3, text: "Q3", correct_answers: ["volcanic ash"] },
                                { q_number: 4, text: "Q4", correct_answers: ["marine clay"] },
                            ],
                        },
                    ],
                },
            ],
            listening_sections: [],
        };

        const summaryResult = gradeExam({
            test,
            examType: "reading",
            safeAnswers: ["volcanic ash", "marine clay", "volcanic ash", "marine clay"],
        });

        expect(summaryResult.score).toBe(4);
        expect(summaryResult.questionReview[0].is_correct).toBe(true);
        expect(summaryResult.questionReview[1].is_correct).toBe(true);
        expect(summaryResult.questionReview[2].is_correct).toBe(true);
        expect(summaryResult.questionReview[3].is_correct).toBe(true);
    });

    it("falls back to group instructions when mult_choice questions have no direct text", () => {
        const test = {
            type: "reading",
            reading_passages: [
                {
                    question_groups: [
                        {
                            type: "mult_choice",
                            instructions: "Choose TWO letters.",
                            questions: [
                                { q_number: 1, correct_answers: ["A"] },
                                { q_number: 2, correct_answers: ["C"] },
                            ],
                        },
                    ],
                },
            ],
            listening_sections: [],
        };

        const result = gradeExam({
            test,
            examType: "reading",
            safeAnswers: ["A", "C"],
        });

        expect(result.questionReview[0].question_text).toBe("Choose TWO letters.");
        expect(result.questionReview[1].question_text).toBe("Choose TWO letters.");
    });

    it("tracks skipped and wrong answers separately", () => {
        const test = {
            type: "reading",
            reading_passages: [
                {
                    question_groups: [
                        {
                            type: "short_answer",
                            questions: [
                                { q_number: 1, text: "Q1", correct_answers: ["cat"] },
                                { q_number: 2, text: "Q2", correct_answers: ["dog"] },
                                { q_number: 3, text: "Q3", correct_answers: ["fish"] },
                            ],
                        },
                    ],
                },
            ],
            listening_sections: [],
        };

        const result = gradeExam({
            test,
            examType: "reading",
            safeAnswers: ["cat", "", "bird"],
        });

        expect(result.score).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.wrong).toBe(1);
        expect(result.total).toBe(3);
    });
});
