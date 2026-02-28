import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submissionFindById: vi.fn(),
  writingFind: vi.fn(),
  gradeEssay: vi.fn(),
  scoreWritingSubmissionFastById: vi.fn(),
  isAiQueueReady: vi.fn(),
  enqueueWritingTaxonomyEnrichmentJob: vi.fn(),
  enrichWritingTaxonomyBySubmissionId: vi.fn(),
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

vi.mock("../../services/grading.service.js", () => ({
  gradeEssay: (...args) => mocks.gradeEssay(...args),
}));

vi.mock("../../services/writingFastScoring.service.js", () => ({
  scoreWritingSubmissionFastById: (...args) => mocks.scoreWritingSubmissionFastById(...args),
}));

vi.mock("../../config/queue.config.js", () => ({
  isAiAsyncModeEnabled: () => true,
}));

vi.mock("../../queues/ai.queue.js", () => ({
  isAiQueueReady: (...args) => mocks.isAiQueueReady(...args),
  enqueueWritingTaxonomyEnrichmentJob: (...args) => mocks.enqueueWritingTaxonomyEnrichmentJob(...args),
}));

vi.mock("../../services/writingTaxonomyEnrichment.service.js", () => ({
  enrichWritingTaxonomyBySubmissionId: (...args) => mocks.enrichWritingTaxonomyBySubmissionId(...args),
}));

describe("writingSubmissionScoring.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    const submissionDoc = {
      _id: "submission-1",
      status: "processing",
      scoring_state: "detail_processing",
      is_ai_fast_graded: false,
      ai_fast_result: null,
      is_ai_graded: false,
      ai_result: null,
      writing_answers: [
        {
          task_id: "task-1",
          task_title: "Task 1",
          answer_text: "Sample answer",
        },
      ],
      save: vi.fn(async function saveSelf() {
        return this;
      }),
    };

    mocks.submissionFindById.mockResolvedValue(submissionDoc);
    mocks.writingFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: "task-1",
          task_type: "task2",
          title: "Sample task",
          prompt: "Task prompt",
          image_url: null,
        },
      ]),
    });

    mocks.scoreWritingSubmissionFastById.mockResolvedValue({
      submission: {
        _id: "submission-1",
        ai_fast_model: "gpt-5-mini",
      },
      fastResult: {
        band_score: 7,
        criteria_scores: {
          task_response: 7,
          coherence_cohesion: 7,
          lexical_resource: 6.5,
          grammatical_range_accuracy: 6.5,
        },
        tasks: [
          {
            task_id: "task-1",
            task_type: "task2",
            band_score: 7,
            criteria_scores: {
              task_response: 7,
              coherence_cohesion: 7,
              lexical_resource: 6.5,
              grammatical_range_accuracy: 6.5,
            },
          },
        ],
      },
    });

    mocks.gradeEssay.mockResolvedValue({
      band_score: 5.5,
      criteria_scores: {
        task_response: 5.5,
        coherence_cohesion: 5.5,
        lexical_resource: 5.5,
        grammatical_range_accuracy: 5.5,
      },
      task_response: [{ text_snippet: "tr", explanation: "tr" }],
      coherence_cohesion: [{ text_snippet: "cc", explanation: "cc" }],
      lexical_resource: [{ text_snippet: "lr", explanation: "lr" }],
      grammatical_range_accuracy: [{ text_snippet: "gra", explanation: "gra" }],
      feedback: ["ok"],
      model: "gpt-4o-mini",
    });

    mocks.isAiQueueReady.mockReturnValue(true);
    mocks.enqueueWritingTaxonomyEnrichmentJob.mockResolvedValue({
      queued: true,
      queue: "writing-taxonomy-enrichment",
      jobId: "taxonomy-1",
    });
    mocks.enrichWritingTaxonomyBySubmissionId.mockResolvedValue({});
  });

  it("downgrades fast score when detail score is lower, then schedules taxonomy", async () => {
    const { scoreWritingSubmissionById } = await import("../../services/writingSubmissionScoring.service.js");
    const result = await scoreWritingSubmissionById({ submissionId: "submission-1", force: false });

    expect(result.skipped).toBe(false);
    expect(mocks.scoreWritingSubmissionFastById).toHaveBeenCalledTimes(1);
    expect(mocks.gradeEssay).toHaveBeenCalledTimes(1);

    expect(result.submission.status).toBe("scored");
    expect(result.submission.scoring_state).toBe("detail_ready");
    expect(result.submission.taxonomy_state).toBe("processing");
    expect(result.submission.score).toBe(5.5);

    expect(result.aiResult.band_score).toBe(5.5);
    expect(result.aiResult.criteria_scores).toEqual({
      task_response: 5.5,
      coherence_cohesion: 5.5,
      lexical_resource: 5.5,
      grammatical_range_accuracy: 5.5,
    });
    expect(result.aiResult.downgraded_fast_score).toBe(true);
    expect(result.submission.ai_fast_result?.band_score).toBe(5.5);
    expect(result.submission.ai_fast_result?.adjusted_by_detail).toBe(true);

    expect(mocks.enqueueWritingTaxonomyEnrichmentJob).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueWritingTaxonomyEnrichmentJob).toHaveBeenCalledWith({
      submissionId: "submission-1",
      force: true,
    });
    expect(mocks.enrichWritingTaxonomyBySubmissionId).not.toHaveBeenCalled();
  });

  it("keeps fast score when detail score is higher", async () => {
    mocks.gradeEssay.mockResolvedValueOnce({
      band_score: 8,
      criteria_scores: {
        task_response: 8,
        coherence_cohesion: 8,
        lexical_resource: 8,
        grammatical_range_accuracy: 8,
      },
      task_response: [{ text_snippet: "tr", explanation: "tr" }],
      coherence_cohesion: [{ text_snippet: "cc", explanation: "cc" }],
      lexical_resource: [{ text_snippet: "lr", explanation: "lr" }],
      grammatical_range_accuracy: [{ text_snippet: "gra", explanation: "gra" }],
      feedback: ["ok"],
      model: "gpt-4o-mini",
    });

    const { scoreWritingSubmissionById } = await import("../../services/writingSubmissionScoring.service.js");
    const result = await scoreWritingSubmissionById({ submissionId: "submission-1", force: false });

    expect(result.aiResult.band_score).toBe(7);
    expect(result.aiResult.criteria_scores).toEqual({
      task_response: 7,
      coherence_cohesion: 7,
      lexical_resource: 6.5,
      grammatical_range_accuracy: 6.5,
    });
    expect(result.aiResult.downgraded_fast_score).toBe(false);
    expect(result.submission.score).toBe(7);
    expect(result.submission.ai_fast_result?.band_score ?? 7).toBe(7);
  });
});
