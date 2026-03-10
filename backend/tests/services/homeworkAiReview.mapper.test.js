import { describe, expect, it } from "vitest";
import { buildHomeworkAiReviewPayload } from "../../services/homeworkAiReview.mapper.js";

describe("homeworkAiReview.mapper", () => {
  it("builds AI payload from backend data and excludes non-eligible media", () => {
    const assignment = {
      _id: "assignment-1",
      title: "Weekly Homework",
      sections: [
        {
          _id: "section-1",
          lessons: [
            {
              _id: "task-1",
              name: "Lesson 1",
              instruction: "Read and answer",
              content_blocks: [
                {
                  type: "passage",
                  order: 0,
                  data: { text: "The ecosystem is changing." },
                },
                {
                  type: "quiz",
                  order: 1,
                  data: {
                    block_id: "quiz-1",
                    questions: [
                      {
                        id: "q1",
                        question: "Main idea?",
                        options: [
                          { id: "a", text: "Option A" },
                          { id: "b", text: "Option B" },
                        ],
                      },
                    ],
                  },
                },
                {
                  type: "answer",
                  order: 2,
                  data: { text: "Reference answer text" },
                },
              ],
            },
          ],
        },
      ],
    };

    const submission = {
      _id: "submission-1",
      assignment_id: "assignment-1",
      task_id: "task-1",
      student_id: "student-1",
      text_answer: "Student written answer",
      image_items: [
        {
          url: "https://example.com/image.jpg",
          mime: "image/jpeg",
        },
      ],
      audio_item: {
        url: "https://example.com/audio.mp3",
        mime: "audio/mpeg",
      },
      meta: {
        objective_answers: {
          quiz: [
            {
              question_key: "quiz-1:q1",
              selected_option_id: "b",
            },
          ],
        },
      },
    };

    const payload = buildHomeworkAiReviewPayload({
      submission,
      assignment,
      student: { _id: "student-1", name: "Alice" },
    });

    expect(payload.assignmentTitle).toBe("Weekly Homework");
    expect(payload.taskTitle).toBe("Lesson 1");
    expect(payload.referenceAnswerText).toContain("Reference answer text");
    expect(payload.promptText).toContain("The ecosystem is changing.");
    expect(payload.promptText).toContain("Main idea?");
    expect(payload.studentAnswerText).toContain("Student written answer");
    expect(payload.studentAnswerText).toContain("Quiz - Main idea?: Option B");
    expect(payload.studentAnswerText).toContain("https://example.com/audio.mp3");
    expect(payload.studentAnswerText).not.toContain("https://example.com/image.jpg");
    expect(payload.meta.has_audio_submission).toBe(true);
  });

  it("throws BAD_REQUEST when submission has no eligible content", () => {
    const assignment = {
      _id: "assignment-1",
      title: "Weekly Homework",
      tasks: [
        {
          _id: "task-1",
          title: "Task 1",
          instruction: "Answer the question",
          content_blocks: [],
        },
      ],
    };

    const submission = {
      _id: "submission-1",
      assignment_id: "assignment-1",
      task_id: "task-1",
      student_id: "student-1",
      text_answer: "",
      image_items: [
        {
          url: "https://example.com/image.jpg",
          mime: "image/jpeg",
        },
      ],
      audio_item: {
        url: "https://example.com/not-audio.mp4",
        mime: "video/mp4",
      },
      meta: {},
    };

    expect(() =>
      buildHomeworkAiReviewPayload({
        submission,
        assignment,
        student: { _id: "student-1", name: "Alice" },
      })).toThrowError("Submission has no AI-review-eligible content");
  });
});
