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
    it("grades mult_choice groups order-independently without double-counting duplicates", () => {
        const test = {
            type: "reading",
            reading_passages: [
                {
                    question_groups: [
                        {
                            type: "mult_choice",
                            questions: [
                                { q_number: 1, text: "Q1", correct_answers: ["A"] },
                                { q_number: 2, text: "Q2", correct_answers: ["C"] },
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
            safeAnswers: ["C", "A"],
        });
        const duplicated = gradeExam({
            test,
            examType: "reading",
            safeAnswers: ["A", "A"],
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
