import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submissionFindById: vi.fn(),
  writingFind: vi.fn(),
  requestOpenAIJsonWithFallback: vi.fn(),
}));

vi.mock("../../models/WritingSubmission.model.js", () => ({
  default: {
    findById: (...args) => mocks.submissionFindById(...args),
  },
}));

vi.mock("../../models/Writing.model.js", () => ({
  default: {
    find: (...args) => mocks.writingFind(...args),
  },
}));

vi.mock("../../utils/aiClient.js", () => ({
  requestOpenAIJsonWithFallback: (...args) => mocks.requestOpenAIJsonWithFallback(...args),
}));

const buildSubmissionDoc = (analysisOverrides = {}) => ({
  _id: "submission-1",
  is_ai_graded: true,
  taxonomy_state: "processing",
  taxonomy_updated_at: null,
  writing_answers: [{ task_id: "task-1" }],
  ai_result: {
    band_score: 6,
    lexical_resource: [],
    grammatical_range_accuracy: [],
    ...analysisOverrides,
  },
  error_logs: [],
  save: vi.fn(async function saveSelf() {
    return this;
  }),
});

describe("writingTaxonomyEnrichment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.WRITING_TAXONOMY_MODEL = "gpt-4o-mini";
    process.env.OPENAI_API_KEY = "test-key";
    mocks.writingFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: "task-1",
            task_type: "task2",
          },
        ]),
      }),
    });
  });

  it("maps obvious issues by heuristic and skips AI fallback", async () => {
    process.env.WRITING_TAXONOMY_AI_FALLBACK = "false";
    const submissionDoc = buildSubmissionDoc({
      lexical_resource: [
        {
          text_snippet: "do a decision",
          type: "error",
          error_code: "NONE",
          explanation: "Collocation error in phrase.",
          improved: "make a decision",
          lexical_unit: "collocation",
        },
      ],
      grammatical_range_accuracy: [
        {
          text_snippet: "He go yesterday",
          type: "error",
          error_code: "NONE",
          explanation: "Tense error.",
          improved: "He went yesterday",
        },
      ],
    });
    mocks.submissionFindById.mockResolvedValue(submissionDoc);

    const { enrichWritingTaxonomyBySubmissionId } = await import("../../services/writingTaxonomyEnrichment.service.js");
    const result = await enrichWritingTaxonomyBySubmissionId({ submissionId: "submission-1", force: true });

    expect(mocks.requestOpenAIJsonWithFallback).not.toHaveBeenCalled();
    expect(result.skipped).toBe(false);
    expect(Array.isArray(submissionDoc.error_logs)).toBe(true);
    expect(submissionDoc.error_logs.length).toBeGreaterThan(0);
    expect(submissionDoc.error_logs.every((log) => log.error_code !== "W-UNCLASSIFIED")).toBe(true);
    expect(submissionDoc.taxonomy_state).toBe("ready");
  });

  it("uses AI fallback for unresolved issues only", async () => {
    process.env.WRITING_TAXONOMY_AI_FALLBACK = "true";
    const submissionDoc = buildSubmissionDoc({
      lexical_resource: [
        {
          text_snippet: "thing is very thing",
          type: "error",
          error_code: "NONE",
          explanation: "Awkward expression in context.",
          improved: "the issue is significant",
          lexical_unit: "word",
        },
      ],
      grammatical_range_accuracy: [
        {
          text_snippet: "People can benefits",
          type: "error",
          error_code: "NONE",
          explanation: "Awkward sentence build.",
          improved: "People can benefit",
        },
      ],
    });
    mocks.submissionFindById.mockResolvedValue(submissionDoc);
    mocks.requestOpenAIJsonWithFallback.mockResolvedValue({
      data: {
        mappings: [
          { issue_index: 0, error_code: "W2-L1", confidence: 0.78 },
          { issue_index: 1, error_code: "W2-G1", confidence: 0.81 },
        ],
      },
    });

    const { enrichWritingTaxonomyBySubmissionId } = await import("../../services/writingTaxonomyEnrichment.service.js");
    const result = await enrichWritingTaxonomyBySubmissionId({ submissionId: "submission-1", force: true });

    expect(mocks.requestOpenAIJsonWithFallback).toHaveBeenCalledTimes(1);
    expect(result.skipped).toBe(false);
    expect(submissionDoc.error_logs.length).toBe(2);
    expect(submissionDoc.error_logs.every((log) => log.error_code !== "W-UNCLASSIFIED")).toBe(true);
    expect(submissionDoc.taxonomy_state).toBe("ready");
  });
});
