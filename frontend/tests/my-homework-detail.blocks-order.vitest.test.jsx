import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

    renderHomeworkRoutes(["/homework/my/assignment-1"]);

    expect(await screen.findByText("Lesson One")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Open Lesson" })[0]);

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

    renderHomeworkRoutes(["/homework/my/assignment-1/lessons/task-1"]);

    const monthLink = await screen.findByRole("link", { name: "Month" });
    fireEvent.click(monthLink);

    expect(await screen.findByText("Lessons")).toBeInTheDocument();
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

    renderHomeworkRoutes(["/homework/my/assignment-1/lessons/invalid-lesson"]);

    expect(await screen.findByText("Lesson not found.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to Month" }));
    expect(await screen.findByText("Lessons")).toBeInTheDocument();
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

    renderHomeworkRoutes(["/homework/my/assignment-1/lessons/task-1"]);

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

    renderHomeworkRoutes(["/homework/my/assignment-1/lessons/task-1"]);

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

    renderHomeworkRoutes(["/homework/my/assignment-1/lessons/task-1"]);

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

    renderHomeworkRoutes(["/homework/my/assignment-1/lessons/task-1"]);

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

    renderHomeworkRoutes(["/homework/my/assignment-1/lessons/task-1"]);

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

    renderHomeworkRoutes(["/homework/my/assignment-1/lessons/task-1"]);

    expect(await screen.findByText("Dictation")).toBeInTheDocument();
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

    renderHomeworkRoutes(["/homework/my/assignment-1/lessons/task-1"]);

    expect(await screen.findByText("Dictation")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type your answer here...")).toBeInTheDocument();
  });
});
