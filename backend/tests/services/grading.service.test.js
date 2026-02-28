import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestOpenAIJsonWithFallback: vi.fn(),
}));

vi.mock("../../utils/aiClient.js", () => ({
  requestOpenAIJsonWithFallback: (...args) => mocks.requestOpenAIJsonWithFallback(...args),
}));

describe("grading.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    process.env.OPENAI_API_KEY = "test-key";
    process.env.WRITING_PIPELINE_PHASED_MODELS = "true";
    process.env.WRITING_FAST_PRIMARY_MODEL = "gpt-5-mini";
    process.env.WRITING_FAST_FALLBACK_MODEL = "gpt-4o-mini";
    process.env.WRITING_DETAIL_PRIMARY_MODEL = "gpt-4o-mini";
    process.env.WRITING_DETAIL_FALLBACK_MODEL = "gpt-4o-mini";
    process.env.WRITING_DETAIL_MAX_OUTPUT_TOKENS = "1600";
  });

  it("routes fast phase to gpt-5-mini and keeps contract without sample_essay", async () => {
    mocks.requestOpenAIJsonWithFallback.mockResolvedValueOnce({
      model: "gpt-5-mini",
      data: {
        band_score: 6.5,
        criteria_scores: {
          task_response: 6.5,
          coherence_cohesion: 6,
          lexical_resource: 6,
          grammatical_range_accuracy: 6.5,
        },
        summary: "Fast summary",
        criteria_notes: {
          task_response: "TR note",
          coherence_cohesion: "CC note",
          lexical_resource: "LR note",
          grammatical_range_accuracy: "GRA note",
        },
      },
    });

    const { gradeEssayFast } = await import("../../services/grading.service.js");
    const result = await gradeEssayFast("Prompt", "Essay text", "task2");

    expect(mocks.requestOpenAIJsonWithFallback).toHaveBeenCalledTimes(1);
    const call = mocks.requestOpenAIJsonWithFallback.mock.calls[0][0];
    expect(call.models[0]).toBe("gpt-5-mini");
    expect(result.band_score).toBe(6.5);
    expect(result.criteria_scores.task_response).toBe(6.5);
    expect(result).not.toHaveProperty("sample_essay");
    expect(result.top_issues).toEqual({
      grammatical_range_accuracy: [],
      lexical_resource: [],
    });
  });

  it("routes detail phase to gpt-4o-mini and enforces GRA/LR priority with short TR/CC", async () => {
    mocks.requestOpenAIJsonWithFallback.mockResolvedValueOnce({
      model: "gpt-4o-mini",
      data: {
        band_score: 5.5,
        criteria_scores: {
          task_response: 5.5,
          coherence_cohesion: 5.5,
          lexical_resource: 5.5,
          grammatical_range_accuracy: 5,
        },
        task_response: [],
        coherence_cohesion: [],
        lexical_resource: [
          {
            text_snippet: "do a decision",
            type: "error",
            error_code: "W2-L2",
            explanation: "Collocation error",
            improved: "make a decision",
          },
        ],
        grammatical_range_accuracy: [
          {
            text_snippet: "He go yesterday",
            type: "error",
            error_code: "W2-G1",
            explanation: "Tense error",
            improved: "He went yesterday",
          },
        ],
      },
    });

    const { gradeEssay } = await import("../../services/grading.service.js");
    const result = await gradeEssay("Prompt", "Essay text", "task2");

    expect(mocks.requestOpenAIJsonWithFallback).toHaveBeenCalledTimes(1);
    const call = mocks.requestOpenAIJsonWithFallback.mock.calls[0][0];
    expect(call.models[0]).toBe("gpt-4o-mini");

    const payload = call.createPayload("gpt-4o-mini");
    const promptText = payload?.messages?.[0]?.content?.[0]?.text || "";
    expect(promptText).toContain("Primary focus: actionable Grammar (GRA) and Lexical Resource (LR) issues.");
    expect(promptText).toContain("TR and CC: always return short notes (1-2 items each).");

    expect(Array.isArray(result.lexical_resource)).toBe(true);
    expect(Array.isArray(result.grammatical_range_accuracy)).toBe(true);
    expect(Array.isArray(result.task_response)).toBe(true);
    expect(Array.isArray(result.coherence_cohesion)).toBe(true);
    expect(result.task_response.length).toBeGreaterThan(0);
    expect(result.coherence_cohesion.length).toBeGreaterThan(0);
    expect(result).not.toHaveProperty("sample_essay");
  });
});
