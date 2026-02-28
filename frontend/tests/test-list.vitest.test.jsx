import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TestList from "../src/features/tests/pages/TestList.jsx";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getTests: vi.fn(),
    getTestCategories: vi.fn(),
    getMyAttemptSummary: vi.fn(),
    isAuthenticated: vi.fn(),
  },
}));

vi.mock("@/shared/api/client", () => ({
  api: mockApi,
}));

const readingTest = {
  _id: "r-1",
  title: "Reading Test Alpha",
  type: "reading",
  category: "Academics",
  reading_passages: [
    {
      title: "Passage A1",
      questions: [{ _id: "q-1" }, { _id: "q-2" }],
      question_groups: [{ type: "tfng" }],
    },
    {
      title: "Passage A2",
      questions: [{ _id: "q-3" }, { _id: "q-4" }],
      question_groups: [{ type: "matching_headings" }],
    },
  ],
};

const listeningTest = {
  _id: "l-1",
  title: "Listening Test Beta",
  type: "listening",
  category: "Work",
  listening_sections: [
    {
      title: "Section B1",
      questions: [{ _id: "q-5" }],
      question_groups: [{ type: "multiple_choice" }],
    },
  ],
};

const writingTest = {
  _id: "w-1",
  title: "Writing Test Gamma",
  type: "writing",
  category: "Academics",
  writing_tasks: [{ title: "Task 1" }, { title: "Task 2" }],
};

const pageTwoTest = {
  _id: "r-2",
  title: "Reading Test Delta",
  type: "reading",
  category: "General",
  reading_passages: [{ title: "Passage D1", question_groups: [{ type: "tfng" }], questions: [] }],
};

function buildListResponse(params = {}) {
  const page = Number(params.page || 1);
  const sourceRows = page === 2 ? [pageTwoTest] : [readingTest, listeningTest, writingTest];

  let rows = sourceRows;
  if (params.type) {
    rows = rows.filter((row) => row.type === params.type);
  }
  if (params.category) {
    rows = rows.filter((row) => String(row.category || "").trim() === params.category);
  }
  if (params.q) {
    const needle = String(params.q).toLowerCase();
    rows = rows.filter(
      (row) =>
        row.title.toLowerCase().includes(needle) ||
        row._id.toLowerCase().includes(needle) ||
        String(row.category || "").toLowerCase().includes(needle) ||
        String(row.type || "").toLowerCase().includes(needle),
    );
  }

  return {
    data: rows,
    pagination: params.page
      ? {
          page,
          limit: 12,
          totalPages: 2,
          totalItems: page === 2 ? 1 : 15,
          hasPrevPage: page > 1,
          hasNextPage: page < 2,
        }
      : undefined,
  };
}

function setupSuccessfulApi() {
  mockApi.isAuthenticated.mockReturnValue(true);
  mockApi.getMyAttemptSummary.mockResolvedValue({
    data: [
      {
        test_id: "r-1",
        latest: { score: 28, total: 40, percentage: 70 },
        best: { score: 31, total: 40, percentage: 78 },
      },
    ],
  });
  mockApi.getTestCategories.mockResolvedValue({
    data: [
      { category: "Academics", count: 2 },
      { category: "Work", count: 1 },
      { category: "General", count: 1 },
    ],
  });
  mockApi.getTests.mockImplementation(async (params = {}) => {
    if (params.page === 1 && params.limit === 1 && !params.includeQuestionGroupTypes) {
      return {
        data: [readingTest],
        pagination: { totalItems: 15 },
      };
    }
    return buildListResponse(params);
  });
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <TestList />
    </MemoryRouter>,
  );

const switchToPartsMode = () => {
  const tab = screen.getByRole("tab", { name: "By parts" });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.mouseUp(tab, { button: 0 });
  fireEvent.click(tab);
};

describe("TestList page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuccessfulApi();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders redesigned hero and cards from API", async () => {
    renderPage();

    expect(await screen.findByText("IELTS Test Studio")).toBeInTheDocument();
    expect(await screen.findByText("Reading Test Alpha")).toBeInTheDocument();

    expect(mockApi.getTests).toHaveBeenCalledWith(
      expect.objectContaining({
        includeQuestionGroupTypes: true,
        page: 1,
        limit: 12,
      }),
    );
  });

  it("debounces search and requests q param", async () => {
    renderPage();
    await screen.findByText("IELTS Test Studio");

    fireEvent.change(screen.getByPlaceholderText("Search tests, categories, or ids..."), {
      target: { value: "beta" },
    });

    await waitFor(
      () => {
        expect(mockApi.getTests).toHaveBeenCalledWith(
          expect.objectContaining({
            q: "beta",
            includeQuestionGroupTypes: true,
          }),
        );
      },
      { timeout: 1800 },
    );
  });

  it("filters by skill type and updates request params", async () => {
    renderPage();
    await screen.findByText("IELTS Test Studio");

    fireEvent.click(screen.getByRole("button", { name: "Reading" }));

    await waitFor(() => {
      expect(mockApi.getTests).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "reading",
        }),
      );
    });
  });

  it("switches to parts mode and renders part cards", async () => {
    renderPage();
    await screen.findByText("IELTS Test Studio");

    switchToPartsMode();

    expect(await screen.findByText("Passage A1")).toBeInTheDocument();
    const partCta = screen.getAllByRole("link", { name: /Start part/i })[0];
    expect(partCta).toHaveAttribute("href", "/tests/r-1/exam?part=0&mode=single");
  });

  it("applies part and question-group filters in parts mode", async () => {
    renderPage();
    await screen.findByText("IELTS Test Studio");

    fireEvent.click(screen.getByRole("button", { name: "Reading" }));
    switchToPartsMode();

    expect(await screen.findByText("Passage A1")).toBeInTheDocument();
    expect(screen.getByText("Passage A2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Passage 2" }));
    await waitFor(() => {
      expect(screen.getByText("Passage A2")).toBeInTheDocument();
      expect(screen.queryByText("Passage A1")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Matching Headings" }));
    await waitFor(() => {
      expect(screen.getByText("Passage A2")).toBeInTheDocument();
    });
  });

  it("filters by category and paginates full mode", async () => {
    renderPage();
    await screen.findByText("IELTS Test Studio");

    fireEvent.click(screen.getByRole("button", { name: /Academics/i }));

    await waitFor(() => {
      expect(mockApi.getTests).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "Academics",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(mockApi.getTests).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        }),
      );
    });
  });

  it("keeps full-card CTA routes unchanged", async () => {
    renderPage();
    await screen.findByText("Reading Test Alpha");

    const startLink = screen.getAllByRole("link", { name: /Start test/i })[0];
    const historyLink = screen.getAllByRole("link", { name: /History/i })[0];

    expect(startLink).toHaveAttribute("href", "/tests/r-1");
    expect(historyLink).toHaveAttribute("href", "/tests/r-1/history");
  });

  it("opens mobile filter sheet", async () => {
    renderPage();
    await screen.findByText("IELTS Test Studio");

    fireEvent.click(screen.getByRole("button", { name: /^Filters$/i }));
    expect(await screen.findByText("Refine by skills, test mode, and parts.")).toBeInTheDocument();
  });

  it("renders error state and retries successfully", async () => {
    mockApi.getTests.mockImplementation(async (params = {}) => {
      if (params.includeQuestionGroupTypes) {
        throw new Error("Network unstable");
      }
      return {
        data: [readingTest],
        pagination: { totalItems: 15 },
      };
    });

    renderPage();

    expect(await screen.findByText("Unable to load tests")).toBeInTheDocument();
    expect(screen.getByText("Network unstable")).toBeInTheDocument();

    setupSuccessfulApi();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Reading Test Alpha")).toBeInTheDocument();
  });
});
