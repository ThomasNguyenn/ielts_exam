import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testFindByIdMock = vi.fn();
const testAttemptCreateMock = vi.fn();
const testAttemptFindMock = vi.fn();
const testAttemptDeleteManyMock = vi.fn();
const userFindByIdMock = vi.fn();
const writingSubmissionCreateMock = vi.fn();
const writingSubmissionDeleteManyMock = vi.fn();
const writingFindByIdMock = vi.fn();
const passageFindByIdMock = vi.fn();
const sectionFindByIdMock = vi.fn();
const addXPMock = vi.fn();
const checkAchievementsMock = vi.fn();
const evaluateObjectiveErrorsAsyncMock = vi.fn();

const createPopulateChain = (value) => {
  const chain = {
    populate: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  chain.populate.mockReturnValue(chain);
  return chain;
};

const createLeanChain = (value) => ({
  lean: vi.fn().mockResolvedValue(value),
});

vi.mock("../../models/Test.model.js", () => ({
  default: {
    findById: testFindByIdMock,
  },
}));

vi.mock("../../models/TestAttempt.model.js", () => ({
  default: {
    create: testAttemptCreateMock,
    find: testAttemptFindMock,
    deleteMany: testAttemptDeleteManyMock,
  },
}));

vi.mock("../../models/User.model.js", () => ({
  default: {
    findById: userFindByIdMock,
  },
}));

vi.mock("../../models/WritingSubmission.model.js", () => ({
  default: {
    create: writingSubmissionCreateMock,
    deleteMany: writingSubmissionDeleteManyMock,
  },
}));

vi.mock("../../models/Writing.model.js", () => ({
  default: {
    findById: writingFindByIdMock,
  },
}));

vi.mock("../../models/Passage.model.js", () => ({
  default: {
    findById: passageFindByIdMock,
  },
}));

vi.mock("../../models/Section.model.js", () => ({
  default: {
    findById: sectionFindByIdMock,
  },
}));

vi.mock("../../services/gamification.service.js", () => ({
  XP_TEST_COMPLETION: 15,
  addXP: addXPMock,
}));

vi.mock("../../services/achievement.service.js", () => ({
  checkAchievements: checkAchievementsMock,
}));

vi.mock("../../services/taxonomy.service.js", () => ({
  evaluateObjectiveErrorsAsync: evaluateObjectiveErrorsAsyncMock,
}));

let submitExamFlow;
let SubmissionError;

beforeAll(async () => {
  const module = await import("../../services/testSubmission.service.js");
  submitExamFlow = module.submitExamFlow;
  SubmissionError = module.SubmissionError;
});

beforeEach(() => {
  vi.clearAllMocks();

  testFindByIdMock.mockImplementation(() => createPopulateChain(null));
  writingFindByIdMock.mockImplementation(() => createLeanChain(null));
  passageFindByIdMock.mockImplementation(() => createLeanChain(null));
  sectionFindByIdMock.mockImplementation(() => createLeanChain(null));

  testAttemptCreateMock.mockResolvedValue(undefined);
  testAttemptDeleteManyMock.mockResolvedValue({ deletedCount: 0 });
  testAttemptFindMock.mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  });

  userFindByIdMock.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  });

  writingSubmissionCreateMock.mockResolvedValue({ _id: "writing-sub-1" });
  writingSubmissionDeleteManyMock.mockResolvedValue({ deletedCount: 0 });
  addXPMock.mockResolvedValue({ added: 15, source: "test" });
  checkAchievementsMock.mockResolvedValue([{ key: "first-test" }]);
  evaluateObjectiveErrorsAsyncMock.mockResolvedValue(undefined);
});

describe("submitExamFlow", () => {
  it("handles core objective scoring flow for reading exams", async () => {
    testFindByIdMock.mockImplementation(() =>
      createPopulateChain({
        _id: "reading-test-1",
        type: "reading",
        reading_passages: [
          {
            question_groups: [
              {
                type: "short_answer",
                questions: [
                  { q_number: 1, text: "Q1", correct_answers: ["A"] },
                  { q_number: 2, text: "Q2", correct_answers: ["B"] },
                ],
              },
            ],
          },
        ],
        listening_sections: [],
        writing_tasks: [],
      }),
    );

    const result = await submitExamFlow({
      testId: "reading-test-1",
      userId: null,
      body: {
        answers: ["A", "B"],
        timeTaken: 180000,
      },
    });

    expect(result.score).toBe(2);
    expect(result.total).toBe(2);
    expect(result.wrong).toBe(0);
    expect(result.timeTaken).toBe(180000);
    expect(result.question_review).toHaveLength(2);
    expect(result.writingSubmissionId).toBeNull();
    expect(result.achievements).toEqual([]);
    expect(result.xpResult).toBeNull();
    expect(testAttemptCreateMock).not.toHaveBeenCalled();
    expect(writingSubmissionCreateMock).not.toHaveBeenCalled();
  });

  it("creates writing submission and returns writingSubmissionId for writing exams", async () => {
    testFindByIdMock.mockImplementation(() =>
      createPopulateChain({
        _id: "writing-test-1",
        type: "writing",
        reading_passages: [],
        listening_sections: [],
        writing_tasks: [
          {
            _id: "task-1",
            title: "Task 1",
          },
        ],
      }),
    );
    writingSubmissionCreateMock.mockResolvedValue({ _id: "writing-sub-42" });
    userFindByIdMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: "user-2",
          name: "Student Two",
          email: "student2@example.com",
        }),
      }),
    });

    const result = await submitExamFlow({
      testId: "writing-test-1",
      userId: "user-2",
      body: {
        answers: [],
        writing: ["This is a writing answer."],
        isPractice: true,
      },
    });

    expect(writingSubmissionCreateMock).toHaveBeenCalledTimes(1);
    expect(writingSubmissionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        test_id: "writing-test-1",
        status: "pending",
        attempt_id: null,
        user_id: "user-2",
      }),
    );
    expect(testAttemptCreateMock).not.toHaveBeenCalled();
    expect(addXPMock).not.toHaveBeenCalled();
    expect(checkAchievementsMock).not.toHaveBeenCalled();
    expect(result.writingSubmissionId).toBe("writing-sub-42");
    expect(result.writing_answers).toEqual(["This is a writing answer."]);
    expect(result.writingCount).toBe(1);
    expect(result.xpResult).toBeNull();
    expect(result.achievements).toEqual([]);
  });

  it("persists listening attempts and awards XP for logged-in real exams", async () => {
    testFindByIdMock.mockImplementation(() =>
      createPopulateChain({
        _id: "listening-test-1",
        type: "listening",
        reading_passages: [],
        listening_sections: [
          {
            question_groups: [
              {
                type: "short_answer",
                questions: [{ q_number: 1, text: "Q1", correct_answers: ["A"] }],
              },
            ],
          },
        ],
        writing_tasks: [],
      }),
    );
    userFindByIdMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: "user-1",
          name: "Learner",
          email: "learner@example.com",
        }),
      }),
    });

    const result = await submitExamFlow({
      testId: "listening-test-1",
      userId: "user-1",
      body: {
        answers: ["A"],
        timeTaken: 95_000,
        isPractice: false,
      },
    });

    expect(testAttemptCreateMock).toHaveBeenCalledTimes(1);
    expect(testAttemptCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        test_id: "listening-test-1",
        type: "listening",
        score: 1,
        total: 1,
        wrong: 0,
        skipped: 0,
        percentage: 100,
        time_taken_ms: 95_000,
      }),
    );
    expect(addXPMock).toHaveBeenCalledWith("user-1", 15, "test");
    expect(checkAchievementsMock).toHaveBeenCalledWith("user-1");
    expect(result.listeningScore).toBe(1);
    expect(result.listeningTotal).toBe(1);
    expect(result.xpResult).toEqual({ added: 15, source: "test" });
    expect(result.achievements).toEqual([{ key: "first-test" }]);
  });

  it("throws SubmissionError(400) when answers is not an array for objective exams", async () => {
    testFindByIdMock.mockImplementation(() =>
      createPopulateChain({
        _id: "reading-test-1",
        type: "reading",
        reading_passages: [],
        listening_sections: [],
        writing_tasks: [],
      }),
    );

    await expect(
      submitExamFlow({
        testId: "reading-test-1",
        userId: null,
        body: {
          answers: "A",
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "answers must be an array",
    });
  });

  it("throws SubmissionError(404) when both test and standalone items are missing", async () => {
    testFindByIdMock.mockImplementation(() => createPopulateChain(null));
    writingFindByIdMock.mockImplementation(() => createLeanChain(null));
    passageFindByIdMock.mockImplementation(() => createLeanChain(null));
    sectionFindByIdMock.mockImplementation(() => createLeanChain(null));

    let thrown;
    try {
      await submitExamFlow({
        testId: "missing-test",
        userId: null,
        body: {
          answers: [],
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SubmissionError);
    expect(thrown).toMatchObject({
      statusCode: 404,
      message: "Test not found",
    });
  });
});
