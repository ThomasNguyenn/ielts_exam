import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QuestionGroup from "../src/features/admin/components/QuestionGroup.jsx";

const baseProps = {
  gi: 0,
  totalGroups: 1,
  isGroupCollapsed: false,
  collapsedQuestions: new Set(),
  questionTypeOptions: [{ value: "matching_information", label: "Matching Information" }],
  onToggleGroupCollapse: vi.fn(),
  onToggleQuestionCollapse: vi.fn(),
  onMove: vi.fn(),
  onRemove: vi.fn(),
  onUpdateGroup: vi.fn(),
  onUpdateQuestion: vi.fn(),
  onAddQuestion: vi.fn(),
  onRemoveQuestion: vi.fn(),
  onSetQuestionOption: vi.fn(),
  onSetCorrectAnswers: vi.fn(),
  onAddHeading: vi.fn(),
  onRemoveHeading: vi.fn(),
  onUpdateHeading: vi.fn(),
  onAddOption: vi.fn(),
  onRemoveOption: vi.fn(),
  onUpdateOption: vi.fn(),
  onAddQuestionOption: vi.fn(),
  onRemoveQuestionOption: vi.fn(),
  onSyncQuestionsFromText: vi.fn(),
  onSyncMultiChoiceCount: vi.fn(),
  showPassageReferenceField: true,
  handleBoldShortcut: vi.fn(),
};

const buildGroup = () => ({
  type: "matching_information",
  group_layout: "default",
  required_count: "",
  use_once: false,
  instructions: "",
  headings: [{ id: "OLD", text: "OLD" }],
  options: [],
  text: "",
  questions: [
    {
      q_number: 1,
      text: "Question 1",
      correct_answers: [],
      explanation: "",
      passage_reference: "",
      option: [],
    },
  ],
});

afterEach(() => {
  cleanup();
});

describe("QuestionGroup matching range generator", () => {
  it("generates and replaces headings from A-C range", () => {
    const onUpdateGroup = vi.fn();
    render(
      <QuestionGroup
        {...baseProps}
        onUpdateGroup={onUpdateGroup}
        group={buildGroup()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("A-G or I-VII"), {
      target: { value: "A-C" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(onUpdateGroup).toHaveBeenCalledWith(0, "headings", [
      { id: "A", text: "A" },
      { id: "B", text: "B" },
      { id: "C", text: "C" },
    ]);
  });

  it("shows inline warning and does not mutate when range is invalid", () => {
    const onUpdateGroup = vi.fn();
    render(
      <QuestionGroup
        {...baseProps}
        onUpdateGroup={onUpdateGroup}
        group={buildGroup()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("A-G or I-VII"), {
      target: { value: "VII-I" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(screen.getByText(/Range must be increasing/i)).toBeInTheDocument();
    expect(onUpdateGroup).not.toHaveBeenCalled();
  });
});
