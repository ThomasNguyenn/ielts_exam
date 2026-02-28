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

  it("runs fast phase twice, averages result, and keeps contract without sample_essay", async () => {
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
    mocks.requestOpenAIJsonWithFallback.mockResolvedValueOnce({
      model: "gpt-5-mini",
      data: {
        band_score: 7,
        criteria_scores: {
          task_response: 7,
          coherence_cohesion: 6.5,
          lexical_resource: 6.5,
          grammatical_range_accuracy: 7,
        },
        summary: "Fast summary pass 2",
        criteria_notes: {
          task_response: "TR note 2",
          coherence_cohesion: "CC note 2",
          lexical_resource: "LR note 2",
          grammatical_range_accuracy: "GRA note 2",
        },
      },
    });

    const { gradeEssayFast } = await import("../../services/grading.service.js");
    const result = await gradeEssayFast("Prompt", "Essay text", "task2");

    expect(mocks.requestOpenAIJsonWithFallback).toHaveBeenCalledTimes(2);
    const call = mocks.requestOpenAIJsonWithFallback.mock.calls[0][0];
    expect(call.models[0]).toBe("gpt-5-mini");
    expect(result.band_score).toBe(7);
    expect(result.criteria_scores.task_response).toBe(7);
    expect(result.criteria_scores.coherence_cohesion).toBe(6.5);
    expect(result.criteria_scores.lexical_resource).toBe(6.5);
    expect(result.criteria_scores.grammatical_range_accuracy).toBe(7);
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
    mocks.requestOpenAIJsonWithFallback.mockResolvedValueOnce({
      model: "gpt-4o-mini",
      data: {
        grammatical_range_accuracy: [],
        lexical_resource: [],
      },
    });

    const { gradeEssay } = await import("../../services/grading.service.js");
    const result = await gradeEssay("Prompt", "Essay text", "task2");

    expect(mocks.requestOpenAIJsonWithFallback).toHaveBeenCalledTimes(2);
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

  it("normalizes GRA/LR text_snippet to compact phrase instead of full sentence", async () => {
    mocks.requestOpenAIJsonWithFallback.mockResolvedValueOnce({
      model: "gpt-4o-mini",
      data: {
        band_score: 5.5,
        criteria_scores: {
          task_response: 5.5,
          coherence_cohesion: 5.5,
          lexical_resource: 5.5,
          grammatical_range_accuracy: 5.5,
        },
        task_response: [],
        coherence_cohesion: [],
        lexical_resource: [
          {
            text_snippet: "In this essay, I very very like to do a decision quickly in many situations.",
            type: "error",
            error_code: "W2-L2",
            explanation: "Collocation error",
            improved: "make a decision",
          },
        ],
        grammatical_range_accuracy: [
          {
            text_snippet: "He go to school yesterday and he not finish homework because he very tired.",
            type: "error",
            error_code: "W2-G1",
            explanation: "Grammar error",
            improved: "He went to school yesterday and did not finish his homework because he was very tired.",
          },
        ],
      },
    });

    const { gradeEssay } = await import("../../services/grading.service.js");
    const result = await gradeEssay("Prompt", Array.from({ length: 120 }).map((_, i) => `word${i}`).join(" "), "task2");

    const lexicalSnippet = String(result?.lexical_resource?.[0]?.text_snippet || "");
    const grammarSnippet = String(result?.grammatical_range_accuracy?.[0]?.text_snippet || "");
    expect(lexicalSnippet.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(4);
    expect(grammarSnippet.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(4);
  });
});
