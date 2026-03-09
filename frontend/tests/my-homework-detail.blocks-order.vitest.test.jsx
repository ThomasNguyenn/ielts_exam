import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MyHomeworkDetailPage from "../src/features/homework/pages/MyHomeworkDetailPage.jsx";
import MyHomeworkLessonPage from "../src/features/homework/pages/MyHomeworkLessonPage.jsx";

const { mockApi, mockShowNotification } = vi.hoisted(() => ({
  mockApi: {
    getUser: vi.fn(),
    homeworkGetMyAssignmentById: vi.fn(),
    homeworkGetAssignmentById: vi.fn(),
    homeworkSubmitTask: vi.fn(),
    homeworkLaunchTaskTracking: vi.fn(),
  },
  mockShowNotification: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({
  api: mockApi,
}));

vi.mock("@/shared/context/NotificationContext", () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

vi.mock("react-lite-youtube-embed", () => ({
  default: ({ title }) => <div data-testid="lite-youtube-embed">{title || "Video"}</div>,
}));

const buildAssignmentResponse = (tasks = []) => ({
  data: {
    _id: "assignment-1",
    title: "Dynamic Block Assignment",
    description: "Assignment description",
    week: 1,
    due_date: "2026-12-31T00:00:00.000Z",
    month: "2026-12",
    tasks,
    submissions: [],
  },
});

const renderHomeworkRoutes = (initialEntries) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/homework/my/:assignmentId" element={<MyHomeworkDetailPage />} />
        <Route path="/homework/my/:assignmentId/lessons/:lessonId" element={<MyHomeworkLessonPage />} />
        <Route path="/student-ielts/homework/:assignmentId" element={<MyHomeworkDetailPage />} />
        <Route path="/student-ielts/homework/:assignmentId/lessons/:lessonId" element={<MyHomeworkLessonPage />} />
      </Routes>
    </MemoryRouter>,
  );

const getBlockOrderForTask = (taskId = "task-1") =>
  screen
    .getAllByTestId("task-content-block")
    .filter((node) => node.getAttribute("data-task-id") === taskId)
    .map((node) => node.getAttribute("data-block-type"));

describe("MyHomework lesson routing and block rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getUser.mockReturnValue({ role: "student", _id: "student-1" });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("navigates from assignment page to a lesson page and renders only selected lesson content", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Lesson One",
          content_blocks: [{ type: "title", order: 0, data: { text: "Lesson One Block" } }],
        },
        {
          _id: "task-2",
          title: "Lesson Two",
          content_blocks: [{ type: "title", order: 0, data: { text: "Lesson Two Block" } }],
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1"]);

    expect(await screen.findByText("Lesson One")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Lesson One").closest(".homework-task-card"));

    expect(await screen.findByText("Lesson One Block")).toBeInTheDocument();
    expect(screen.queryByText("Lesson Two Block")).not.toBeInTheDocument();
  });

  it("breadcrumb Month link navigates back to the assignment lesson list page", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Lesson One",
          content_blocks: [{ type: "title", order: 0, data: { text: "Lesson One Block" } }],
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    const backButton = await screen.findByRole("button", { name: "Back" });
    fireEvent.click(backButton);

    expect(await screen.findByRole("heading", { name: "Lessons" })).toBeInTheDocument();
  });

  it("shows friendly not found state for invalid lesson id", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Lesson One",
          content_blocks: [{ type: "title", order: 0, data: { text: "Lesson One Block" } }],
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/invalid-lesson"]);

    expect(await screen.findByText("Lesson not found.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to Month" }));
    expect(await screen.findByRole("heading", { name: "Lessons" })).toBeInTheDocument();
  });

  it("renders [video, title] in exact order", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Task 1",
          content_blocks: [
            { type: "video", order: 0, data: { url: "https://cdn.example.com/lesson-video.mp4" } },
            { type: "title", order: 1, data: { text: "Title After Video" } },
          ],
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    expect(await screen.findByText("Title After Video")).toBeInTheDocument();
    expect(getBlockOrderForTask()).toEqual(["video", "title"]);
  });

  it("renders [title, video] in exact order", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Task 1",
          content_blocks: [
            { type: "title", order: 0, data: { text: "Title Before Video" } },
            { type: "video", order: 1, data: { url: "https://cdn.example.com/lesson-video.mp4" } },
          ],
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    expect(await screen.findByText("Title Before Video")).toBeInTheDocument();
    expect(getBlockOrderForTask()).toEqual(["title", "video"]);
  });

  it("ignores unknown block type without crashing", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Task 1",
          content_blocks: [
            { type: "unknown_block", order: 0, data: { text: "Unknown Block" } },
            { type: "title", order: 1, data: { text: "Known Title Block" } },
          ],
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    expect(await screen.findByText("Known Title Block")).toBeInTheDocument();
    expect(getBlockOrderForTask()).toEqual(["title"]);
  });

  it("renders quiz block from questions array", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Task 1",
          content_blocks: [
            {
              type: "quiz",
              order: 0,
              data: {
                questions: [
                  {
                    id: "q-1",
                    question: "Question One?",
                    options: [
                      { id: "o-1", text: "Option A1" },
                      { id: "o-2", text: "Option B1" },
                    ],
                  },
                  {
                    id: "q-2",
                    question: "Question Two?",
                    options: [
                      { id: "o-3", text: "Option A2" },
                      { id: "o-4", text: "Option B2" },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    expect(await screen.findByText("Question One?")).toBeInTheDocument();
    expect(screen.getByText("Question Two?")).toBeInTheDocument();
    expect(screen.getByText("Option A1")).toBeInTheDocument();
    expect(screen.getByText("Option B2")).toBeInTheDocument();
    expect(getBlockOrderForTask()).toEqual(["quiz"]);
  });

  it("keeps legacy single-question quiz rendering", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Task 1",
          content_blocks: [
            {
              type: "quiz",
              order: 0,
              data: {
                question: "Legacy question?",
                options: [
                  { id: "o-1", text: "Legacy Option 1" },
                  { id: "o-2", text: "Legacy Option 2" },
                ],
              },
            },
          ],
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    expect(await screen.findByText("Legacy question?")).toBeInTheDocument();
    expect(screen.getByText("Legacy Option 1")).toBeInTheDocument();
  });

  it("renders dictation block and does not render transcript text", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Task 1",
          content_blocks: [
            {
              type: "dictation",
              order: 0,
              data: {
                prompt: "Listen and write the sentence.",
                audio_url: "https://cdn.example.com/dictation-a.mp3",
                transcript: "Hidden transcript text should not appear",
              },
            },
          ],
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    expect((await screen.findAllByText("Listen and write the sentence.")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Hidden transcript text should not appear")).not.toBeInTheDocument();
    expect(getBlockOrderForTask()).toEqual(["dictation"]);
  });

  it("falls back to text answer when lesson has dictation but no input block", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Task 1",
          content_blocks: [
            {
              type: "dictation",
              order: 0,
              data: {
                prompt: "Type what you hear.",
                audio_url: "https://cdn.example.com/dictation-b.mp3",
              },
            },
          ],
          requires_text: false,
          requires_image: false,
          requires_audio: false,
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    expect((await screen.findAllByText("Type what you hear.")).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/Type your answer here/i)).toBeInTheDocument();
  });

  it("scopes launch loading state to the clicked internal block only", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Task 1",
          content_blocks: [
            {
              type: "internal",
              order: 0,
              data: {
                block_id: "slot-a",
                resource_slot_key: "slot:a",
                resource_ref_type: "test",
                resource_ref_id: "test-a",
              },
            },
            {
              type: "internal",
              order: 1,
              data: {
                block_id: "slot-b",
                resource_slot_key: "slot:b",
                resource_ref_type: "test",
                resource_ref_id: "test-b",
              },
            },
          ],
        },
      ]),
    );

    let resolveLaunch = null;
    mockApi.homeworkLaunchTaskTracking.mockImplementation(
      () => new Promise((resolve) => {
        resolveLaunch = resolve;
      }),
    );
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    const launchButtons = await screen.findAllByRole("button", { name: "Launch Resource" });
    expect(launchButtons).toHaveLength(2);

    fireEvent.click(launchButtons[0]);

    expect(await screen.findByRole("button", { name: "Launching..." })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Launch Resource" })).toHaveLength(1);

    resolveLaunch?.({
      data: {
        launch_url: "https://example.com/test-a",
      },
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Launch Resource" })).toHaveLength(2);
    });
  });

  it("keeps invalid internal block isolated while valid block launches", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Task 1",
          content_blocks: [
            {
              type: "internal",
              order: 0,
              data: {
                block_id: "slot-invalid",
                resource_slot_key: "slot:invalid",
                resource_ref_type: "test",
              },
            },
            {
              type: "internal",
              order: 1,
              data: {
                block_id: "slot-valid",
                resource_slot_key: "slot:valid",
                resource_ref_type: "test",
                resource_ref_id: "test-valid",
              },
            },
          ],
        },
      ]),
    );

    mockApi.homeworkLaunchTaskTracking.mockResolvedValue({
      data: {
        launch_url: "https://example.com/test-valid",
      },
    });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    const launchButtons = await screen.findAllByRole("button", { name: "Launch Resource" });
    expect(launchButtons).toHaveLength(2);
    expect(launchButtons[0]).toBeDisabled();
    expect(launchButtons[1]).not.toBeDisabled();

    fireEvent.click(launchButtons[1]);

    await waitFor(() => {
      expect(mockApi.homeworkLaunchTaskTracking).toHaveBeenCalledTimes(1);
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("renders mission resources from task data and opens passage resource by scrolling", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Reading Mission",
          instruction: "- Note key words\n- Finish all resources\n- Upload your work",
          content_blocks: [
            { type: "passage", order: 0, data: { block_id: "p-1", text: "Passage body" } },
            { type: "video", order: 1, data: { block_id: "v-1", url: "https://cdn.example.com/lesson-video.mp4" } },
            {
              type: "internal",
              order: 2,
              data: {
                block_id: "i-1",
                resource_slot_key: "slot:i-1",
                resource_ref_type: "passage",
                resource_ref_id: "internal-1",
              },
            },
          ],
        },
      ]),
    );

    const existingDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
    const scrollSpy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollSpy,
    });

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    expect(await screen.findByText("Reading Mission")).toBeInTheDocument();
    const missionButtons = screen.getAllByRole("button", { name: /^M/i });
    expect(missionButtons.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(missionButtons[0]);
    expect(scrollSpy).toHaveBeenCalledTimes(1);

    if (existingDescriptor) {
      Object.defineProperty(Element.prototype, "scrollIntoView", existingDescriptor);
    } else {
      delete Element.prototype.scrollIntoView;
    }
  });

  it("uses shadcn form controls in redesigned lesson blocks and submission panel", async () => {
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Task 1",
          requires_text: true,
          content_blocks: [
            {
              type: "gapfill",
              order: 0,
              data: {
                mode: "numbered",
                prompt: "Complete the sentence",
                numbered_items: ["I [*am/is] happy with [result]."],
              },
            },
          ],
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    expect((await screen.findAllByText("Complete the sentence")).length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Blank 2")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type your answer here/i)).toBeInTheDocument();
  });

  it("disables submit and internal launch in preview mode", async () => {
    mockApi.getUser.mockReturnValue({ role: "teacher", _id: "teacher-1" });
    mockApi.homeworkGetAssignmentById.mockResolvedValue({
      data: {
        _id: "assignment-1",
        title: "Preview Assignment",
        due_date: "2026-12-31T00:00:00.000Z",
        sections: [
          {
            _id: "section-1",
            is_published: true,
            lessons: [
              {
                _id: "task-1",
                is_published: true,
                title: "Preview Task",
                content_blocks: [
                  {
                    type: "internal",
                    order: 0,
                    data: {
                      block_id: "slot-1",
                      resource_slot_key: "slot:1",
                      resource_ref_type: "test",
                      resource_ref_id: "preview-resource",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1?preview=1"]);

    const previewSubmit = await screen.findByRole("button", { name: "Preview only" });
    expect(previewSubmit).toBeDisabled();
    expect(screen.getByRole("button", { name: "Launch Resource" })).toBeDisabled();
  });

  it("submits objective answers payload without regression", async () => {
    mockApi.homeworkSubmitTask.mockResolvedValue({ ok: true });
    mockApi.homeworkGetMyAssignmentById.mockResolvedValue(
      buildAssignmentResponse([
        {
          _id: "task-1",
          title: "Task 1",
          requires_text: true,
          content_blocks: [
            {
              type: "quiz",
              order: 0,
              data: {
                questions: [
                  {
                    id: "q-1",
                    question: "Question One?",
                    options: [
                      { id: "o-1", text: "Option A1" },
                      { id: "o-2", text: "Option B1" },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ]),
    );

    renderHomeworkRoutes(["/student-ielts/homework/assignment-1/lessons/task-1"]);

    fireEvent.click(await screen.findByRole("button", { name: /Option A1/i }));
    fireEvent.change(screen.getByPlaceholderText(/Type your answer here/i), {
      target: { value: "My final answer" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(mockApi.homeworkSubmitTask).toHaveBeenCalledTimes(1);
    });

    const submittedFormData = mockApi.homeworkSubmitTask.mock.calls[0][2];
    expect(submittedFormData.get("text_answer")).toBe("My final answer");
    const objectiveAnswers = JSON.parse(submittedFormData.get("objective_answers"));
    expect(objectiveAnswers.quiz).toHaveLength(1);
    expect(objectiveAnswers.quiz[0].selected_option_id).toBe("o-1");
  });
});
