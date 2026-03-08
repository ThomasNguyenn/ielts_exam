import { beforeEach, describe, expect, it, vi } from "vitest";

const requestOpenAIJsonWithFallback = vi.fn();

vi.mock("../../utils/aiClient.js", () => ({
  requestOpenAIJsonWithFallback,
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    constructor() {}
  },
}));

const importService = async () => {
  vi.resetModules();
  process.env.OPENAI_API_KEY = "test-key";
  return import("../../services/homeworkGen.service.js");
};

describe("homeworkGen.service", () => {
  beforeEach(() => {
    requestOpenAIJsonWithFallback.mockReset();
  });

  it("returns normalized quiz questions when AI payload is valid", async () => {
    requestOpenAIJsonWithFallback.mockResolvedValue({
      data: {
        questions: [
          { question: "What is the main idea?", options: ["A", "B", "C", "D"] },
          { question: "Which statement is true?", options: ["A1", "B1", "C1", "D1"] },
        ],
      },
      meta: { model: "gpt-test" },
    });

    const { generateHomeworkQuizBlock } = await importService();
    const result = await generateHomeworkQuizBlock({
      prompt: "Create reading comprehension questions",
      questionCount: 2,
      optionsPerQuestion: 4,
    });

    expect(result.meta.model).toBe("gpt-test");
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].question).toBe("What is the main idea?");
    expect(result.questions[0].options).toEqual(["A", "B", "C", "D"]);
  });

  it("normalizes missing data and pads to requested counts", async () => {
    requestOpenAIJsonWithFallback.mockResolvedValue({
      data: {
        questions: [{ question: "Only one question", options: ["Only one option"] }],
      },
      meta: { model: "gpt-test" },
    });

    const { generateHomeworkQuizBlock } = await importService();
    const result = await generateHomeworkQuizBlock({
      prompt: "Generate quiz",
      questionCount: 3,
      optionsPerQuestion: 4,
    });

    expect(result.questions).toHaveLength(3);
    result.questions.forEach((question) => {
      expect(question.options).toHaveLength(4);
      expect(question).not.toHaveProperty("correct_option_ids");
    });
  });

  it("clamps generation config to supported ranges", async () => {
    const { clampHomeworkQuizGenerationConfig } = await importService();
    const clamped = clampHomeworkQuizGenerationConfig({
      questionCount: 200,
      optionsPerQuestion: 0,
    });

    expect(clamped.questionCount).toBe(20);
    expect(clamped.optionsPerQuestion).toBe(2);
  });
});

