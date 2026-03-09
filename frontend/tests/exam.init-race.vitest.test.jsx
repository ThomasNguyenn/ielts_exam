import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryRouter,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Exam from "../src/features/tests/pages/Exam.jsx";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getExam: vi.fn(),
    submitExam: vi.fn(),
    trackTestActivityOpen: vi.fn(),
    trackTestActivityStart: vi.fn(),
    trackTestActivityHeartbeat: vi.fn(),
    trackTestActivityAnswer: vi.fn(),
  },
}));

vi.mock("@/shared/api/client", () => ({
  api: mockApi,
}));

vi.mock("../src/features/tests/pages/examHelpers", () => ({
  calculateIELTSBand: vi.fn(() => "0.0"),
  buildQuestionSlots: vi.fn((exam) => exam.__slots || []),
  buildSteps: vi.fn((exam) => exam.__steps || []),
}));

vi.mock("../src/features/tests/components/exam/StepContent.jsx", () => ({
  default: ({ answers = [], setAnswer, listeningAudioUrl }) => (
    <div>
      <p data-testid="answers-state">{JSON.stringify(answers)}</p>
      <p data-testid="listening-audio-url">{String(listeningAudioUrl || "")}</p>
      <button type="button" onClick={() => setAnswer?.(0, "A")}>
        answer-first
      </button>
    </div>
  ),
}));

vi.mock("../src/features/tests/components/exam/WritingStepContent.jsx", () => ({
  default: () => <div data-testid="writing-step-content" />,
}));

vi.mock("../src/features/tests/components/review-mode/ReviewExamLayout.jsx", () => ({
  default: () => <div data-testid="review-layout" />,
}));

vi.mock("@/shared/components/IELTSSettings", () => ({
  default: () => <div data-testid="mock-ielts-settings" />,
}));

function createExamPayload(title, idSeed, options = {}) {
  const stepCount = Number.isFinite(Number(options.stepCount)) ? Math.max(1, Number(options.stepCount)) : 1;
  const examType = String(options.type || "reading");
  const isRealTest = Boolean(options.isRealTest);
  const duration = Number.isFinite(Number(options.duration)) ? Number(options.duration) : 60;
  const listeningItemAudioUrl = options.listeningItemAudioUrl || null;
  const fullAudio = options.fullAudio || null;
  const steps = Array.from({ length: stepCount }, (_, stepIndex) => ({
    label: `Passage ${stepIndex + 1}`,
    type: examType,
    startSlotIndex: 0,
    endSlotIndex: 1,
    item: {
      _id: `item-${idSeed}-${stepIndex + 1}`,
      title: `Part ${idSeed}-${stepIndex + 1}`,
      content: "",
      transcript: "",
      audio_url: examType === "listening" ? listeningItemAudioUrl : null,
      question_groups: [
        {
          type: "gap_fill",
          questions: [{ q_number: 1, text: "Question 1" }],
        },
      ],
    },
  }));

  return {
    title,
    type: examType,
    duration,
    is_standalone: false,
    is_real_test: isRealTest,
    full_audio: fullAudio,
    submitted: null,
    sections: [{ type: examType }],
    __slots: [
      {
        type: "gap_fill",
        q_number: 1,
        text: "Question 1",
      },
    ],
    __steps: steps,
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderExamRoute(initialEntry) {
  const router = createMemoryRouter(
    [{ path: "/exam/:id", element: <Exam /> }],
    { initialEntries: [initialEntry] },
  );
  const utils = render(<RouterProvider router={router} />);
  return { ...utils, router };
}

function createSubmitPayload(overrides = {}) {
  return {
    score: 1,
    total: 1,
    wrong: 0,
    timeTaken: 1000,
    question_review: [
      {
        question_number: 1,
        type: "gap_fill",
        your_answer: "A",
        correct_answer: "A",
        is_correct: true,
      },
    ],
    ...overrides,
  };
}

describe("Exam initialization guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    if (!window.matchMedia) {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    }
    mockApi.submitExam.mockResolvedValue({ data: { score: 0, question_review: [] } });
    mockApi.trackTestActivityOpen.mockResolvedValue({ data: null });
    mockApi.trackTestActivityStart.mockResolvedValue({ data: null });
    mockApi.trackTestActivityHeartbeat.mockResolvedValue({ data: null });
    mockApi.trackTestActivityAnswer.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("ignores stale getExam responses when navigating to a new exam id", async () => {
    const examA = createDeferred();
    const examB = createDeferred();

    mockApi.getExam.mockImplementation((id) => {
      if (id === "a") return examA.promise;
      if (id === "b") return examB.promise;
      return Promise.reject(new Error(`unexpected id ${id}`));
    });

    const { router } = renderExamRoute("/exam/a");
    await waitFor(() =>
      expect(mockApi.getExam).toHaveBeenCalledWith("a", expect.any(Object)),
    );

    await router.navigate("/exam/b");
    await waitFor(() =>
      expect(mockApi.getExam).toHaveBeenCalledWith("b", expect.any(Object)),
    );

    examB.resolve({ data: createExamPayload("Exam B", "b") });
    expect(await screen.findByText("Part b-1")).toBeInTheDocument();

    examA.resolve({ data: createExamPayload("Exam A", "a") });

    await waitFor(() => {
      expect(screen.getByText("Part b-1")).toBeInTheDocument();
      expect(screen.queryByText("Part a-1")).not.toBeInTheDocument();
    });
  });

  it("does not reset answers on unrelated query-string changes", async () => {
    mockApi.getExam.mockResolvedValue({ data: createExamPayload("Exam Query", "query") });

    const { router } = renderExamRoute("/exam/query?mode=single&part=0&foo=1");
    await screen.findByText("Part query-1");

    fireEvent.click(screen.getByRole("button", { name: "answer-first" }));
    await waitFor(() => {
      expect(screen.getByTestId("answers-state").textContent).toContain("A");
    });

    await router.navigate("/exam/query?mode=single&part=0&foo=2");

    await waitFor(() => {
      expect(screen.getByTestId("answers-state").textContent).toContain("A");
    });
    expect(mockApi.getExam).toHaveBeenCalledTimes(1);
  });

  it("resets submitted and step state when navigating to another exam", async () => {
    const examA = createExamPayload("Exam A", "a", { stepCount: 2 });
    const examB = createExamPayload("Exam B", "b", { stepCount: 1 });
    mockApi.getExam.mockImplementation((id) => {
      if (id === "a") return Promise.resolve({ data: examA });
      if (id === "b") return Promise.resolve({ data: examB });
      return Promise.reject(new Error(`unexpected id ${id}`));
    });
    mockApi.submitExam.mockResolvedValue({ data: createSubmitPayload() });

    const { router } = renderExamRoute("/exam/a");
    await screen.findByText("Part a-1");
    fireEvent.click(screen.getByRole("button", { name: "Part 2" }));
    await screen.findByText("Part a-2");
    fireEvent.click(screen.getByRole("button", { name: "Finish Test" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, Finish" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Finish Test" })).not.toBeInTheDocument();
    });

    await router.navigate("/exam/b");
    await screen.findByText("Part b-1");
    expect(screen.getByRole("button", { name: "Finish Test" })).toBeInTheDocument();
    expect(screen.getByTestId("answers-state").textContent).not.toContain("A");
  });

  it("removes corrupted draft json and keeps loading exam", async () => {
    mockApi.getExam.mockResolvedValue({
      data: createExamPayload("Exam Draft", "draft", { isRealTest: true }),
    });
    const draftStorageKey = "exam-draft:draft:full:full";
    window.localStorage.setItem(draftStorageKey, "{bad-json");

    renderExamRoute("/exam/draft");
    await screen.findByText("Part draft-1");

    const nextDraft = window.localStorage.getItem(draftStorageKey);
    expect(nextDraft).toBeTruthy();
    expect(nextDraft).not.toBe("{bad-json");
    expect(() => JSON.parse(nextDraft)).not.toThrow();
  });

  it("computes submit timeTaken from timer remaining instead of stale startTime", async () => {
    mockApi.getExam.mockResolvedValue({
      data: createExamPayload("Exam Timer", "timer", {
        isRealTest: true,
        duration: 60,
      }),
    });
    mockApi.submitExam.mockResolvedValue({ data: createSubmitPayload() });
    const draftStorageKey = "exam-draft:timer:full:full";
    window.localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        version: 2,
        updatedAt: Date.now(),
        isSingleMode: false,
        answers: [""],
        writingAnswers: [],
        currentStep: 0,
        timeRemaining: 3000,
        startTime: Date.now() - 5 * 60 * 60 * 1000,
      }),
    );

    renderExamRoute("/exam/timer");
    await screen.findByText("Part timer-1");

    fireEvent.click(screen.getByRole("button", { name: "Finish Test" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, Finish" }));

    await waitFor(() => {
      expect(mockApi.submitExam).toHaveBeenCalled();
    });
    const [, body] = mockApi.submitExam.mock.calls.at(-1);
    expect(body.timeTaken).toBeGreaterThanOrEqual(599000);
    expect(body.timeTaken).toBeLessThanOrEqual(601500);
  });

  it("keeps tracking answer queue after failure and retries", async () => {
    mockApi.getExam.mockResolvedValue({ data: createExamPayload("Exam Track", "track") });
    mockApi.trackTestActivityAnswer
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ data: null });

    renderExamRoute("/exam/track?hwctx=abc");
    await screen.findByText("Part track-1");

    fireEvent.click(screen.getByRole("button", { name: "answer-first" }));

    await waitFor(() => {
      expect(mockApi.trackTestActivityAnswer).toHaveBeenCalledTimes(1);
    }, { timeout: 2500 });
    await waitFor(() => {
      expect(mockApi.trackTestActivityAnswer).toHaveBeenCalledTimes(2);
    }, { timeout: 5000 });

    const [, firstPayload] = mockApi.trackTestActivityAnswer.mock.calls[0];
    const [, secondPayload] = mockApi.trackTestActivityAnswer.mock.calls[1];
    expect(firstPayload.updates).toEqual(
      expect.arrayContaining([{ question_key: "q-1", answer_value: "A" }]),
    );
    expect(secondPayload.updates).toEqual(
      expect.arrayContaining([{ question_key: "q-1", answer_value: "A" }]),
    );
  });

  it("uses keepalive heartbeat on beforeunload and does not flush answer batch there", async () => {
    mockApi.getExam.mockResolvedValue({ data: createExamPayload("Exam Unload", "unload") });

    renderExamRoute("/exam/unload?hwctx=abc");
    await screen.findByText("Part unload-1");

    act(() => {
      window.dispatchEvent(new Event("beforeunload"));
    });

    await waitFor(() => {
      expect(mockApi.trackTestActivityHeartbeat).toHaveBeenCalled();
    });
    const unloadCall = mockApi.trackTestActivityHeartbeat.mock.calls.find(
      ([, payload]) => payload?.source === "tests_exam_unload",
    );
    expect(unloadCall).toBeTruthy();
    expect(unloadCall[2]).toMatchObject({
      keepalive: true,
      skipAuthRefresh: true,
    });
    expect(mockApi.trackTestActivityAnswer).not.toHaveBeenCalled();
  });

  it("uses step listening audio url in single mode", async () => {
    mockApi.getExam.mockResolvedValue({
      data: createExamPayload("Exam Listening", "listen", {
        type: "listening",
        fullAudio: "https://cdn.example.com/full.mp3",
        listeningItemAudioUrl: "https://cdn.example.com/part.mp3",
      }),
    });

    renderExamRoute("/exam/listen?mode=single&part=0");
    await screen.findByText("Part listen-1");

    expect(screen.getByTestId("listening-audio-url").textContent).toBe(
      "https://cdn.example.com/part.mp3",
    );
  });
});
