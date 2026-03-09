import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StepContent from "../src/features/tests/components/exam/StepContent.jsx";

vi.mock("@/shared/components/HighlightableContent", async () => {
  const ReactRef = await vi.importActual("react");
  return {
    default: ReactRef.forwardRef(function MockHighlightableContent(
      { htmlContent = "", tagName = "div", onUpdateHtml, serializeHtmlForUpdate, ...props },
      ref,
    ) {
      const safeTag = typeof tagName === "string" ? tagName : "div";
      return ReactRef.createElement(safeTag, {
        ...props,
        ref,
        dangerouslySetInnerHTML: { __html: htmlContent },
      });
    }),
    HighlightableWrapper: ({ children, tagName = "div", ...props }) => {
      const safeTag = typeof tagName === "string" ? tagName : "div";
      return React.createElement(safeTag, props, children);
    },
    tokenizeHtml: (html = "") => html,
  };
});

afterEach(() => {
  cleanup();
});

function createMatchingStep({ groupType, useOnce, headings }) {
  const resolvedHeadings = Array.isArray(headings) && headings.length > 0
    ? headings
    : [
      { id: "A", text: "Alpha" },
      { id: "B", text: "Beta" },
    ];

  const group = {
    type: groupType,
    use_once: useOnce,
    instructions: "Match the statements",
    headings: resolvedHeadings,
    questions: [
      { q_number: 1, text: "Statement 1" },
      { q_number: 2, text: "Statement 2" },
    ],
  };

  return {
    step: {
      type: "listening",
      startSlotIndex: 0,
      item: {
        _id: "matching-section",
        content: "",
        question_groups: [group],
      },
    },
    slots: [
      { type: groupType, q_number: 1, headings: resolvedHeadings, option: [] },
      { type: groupType, q_number: 2, headings: resolvedHeadings, option: [] },
    ],
  };
}

function renderMatchingStep({ groupType, useOnce, headings, initialAnswers = ["", ""] }) {
  const { step, slots } = createMatchingStep({ groupType, useOnce, headings });

  function StatefulHarness() {
    const [answers, setAnswers] = React.useState(initialAnswers);
    const setAnswer = (index, value) => {
      setAnswers((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });
    };

    return (
      <StepContent
        step={step}
        slots={slots}
        answers={answers}
        setAnswer={setAnswer}
        passageStates={{}}
        setPassageState={vi.fn()}
        showResult={false}
        listeningAudioUrl={null}
        onListeningAudioEnded={vi.fn()}
        reviewMode={false}
        reviewLookup={{}}
      />
    );
  }

  return render(<StatefulHarness />);
}

function dropMatchingToken(node, token) {
  fireEvent.drop(node, {
    dataTransfer: {
      getData: (type) => (type === "application/x-matching-token" ? token : ""),
    },
  });
}

function createMultiSelectStep({ options }) {
  const resolvedOptions = Array.isArray(options) && options.length > 0
    ? options
    : [
      { id: "opt-1", label: "A", text: "Same text" },
      { id: "opt-2", label: "B", text: "Same text" },
    ];

  const group = {
    type: "mult_choice_multi",
    group_layout: "checkbox",
    questions: [
      { q_number: 1, text: "Choose two", option: resolvedOptions },
      { q_number: 2, text: "Choose two", option: resolvedOptions },
    ],
  };

  return {
    step: {
      type: "reading",
      startSlotIndex: 0,
      item: {
        _id: "multi-select-section",
        content: "",
        question_groups: [group],
      },
    },
    slots: [
      { type: "mult_choice_multi", q_number: 1, option: resolvedOptions },
      { type: "mult_choice_multi", q_number: 2, option: resolvedOptions },
    ],
  };
}

function renderMultiSelectStep({ options }) {
  const { step, slots } = createMultiSelectStep({ options });

  function StatefulHarness() {
    const [answers, setAnswers] = React.useState(["", ""]);
    const setAnswer = (index, value) => {
      setAnswers((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });
    };

    return (
      <StepContent
        step={step}
        slots={slots}
        answers={answers}
        setAnswer={setAnswer}
        passageStates={{}}
        setPassageState={vi.fn()}
        showResult={false}
        listeningAudioUrl={null}
        onListeningAudioEnded={vi.fn()}
        reviewMode={false}
        reviewLookup={{}}
      />
    );
  }

  return render(<StatefulHarness />);
}

describe("StepContent matching use_once behavior", () => {
  it("allows reusing same option in matching_information when use_once is string false", () => {
    const { container } = renderMatchingStep({
      groupType: "matching_information",
      useOnce: "false",
    });

    const dropzones = container.querySelectorAll(".matching-dropzone");
    expect(dropzones.length).toBe(2);

    dropMatchingToken(dropzones[0], "A");
    dropMatchingToken(dropzones[1], "A");

    expect(container.querySelectorAll(".matching-selected").length).toBe(2);
  });

  it("allows reusing same option in matching_features when use_once is string false", () => {
    const { container } = renderMatchingStep({
      groupType: "matching_features",
      useOnce: "false",
    });

    const dropzones = container.querySelectorAll(".matching-dropzone");
    expect(dropzones.length).toBe(2);

    dropMatchingToken(dropzones[0], "A");
    dropMatchingToken(dropzones[1], "A");

    expect(container.querySelectorAll(".matching-selected").length).toBe(2);
  });

  it("treats legacy string null as disabled use_once for matching_information", () => {
    const { container } = renderMatchingStep({
      groupType: "matching_information",
      useOnce: "null",
    });

    const dropzones = container.querySelectorAll(".matching-dropzone");
    expect(dropzones.length).toBe(2);

    dropMatchingToken(dropzones[0], "A");
    dropMatchingToken(dropzones[1], "A");

    expect(container.querySelectorAll(".matching-selected").length).toBe(2);
  });

  it("allows reusing same option in matching_headings when use_once is false", () => {
    const { container } = renderMatchingStep({
      groupType: "matching_headings",
      useOnce: "false",
    });

    const dropzones = container.querySelectorAll(".matching-dropzone");
    expect(dropzones.length).toBe(2);

    dropMatchingToken(dropzones[0], "A");
    dropMatchingToken(dropzones[1], "A");

    expect(container.querySelectorAll(".matching-selected").length).toBe(2);
  });

  it("enforces single-use when matching_information has explicit use_once true", () => {
    const { container } = renderMatchingStep({
      groupType: "matching_information",
      useOnce: true,
    });

    const dropzones = container.querySelectorAll(".matching-dropzone");
    expect(dropzones.length).toBe(2);

    dropMatchingToken(dropzones[0], "A");
    dropMatchingToken(dropzones[1], "A");

    expect(container.querySelectorAll(".matching-selected").length).toBe(1);
  });

  it("defaults matching_headings to single-use when use_once is unset", () => {
    const { container } = renderMatchingStep({
      groupType: "matching_headings",
    });

    const dropzones = container.querySelectorAll(".matching-dropzone");
    expect(dropzones.length).toBe(2);

    dropMatchingToken(dropzones[0], "A");
    dropMatchingToken(dropzones[1], "A");

    expect(container.querySelectorAll(".matching-selected").length).toBe(1);
  });

  it("resolves selected option by id first, then label/text for legacy answers", () => {
    const { container } = renderMatchingStep({
      groupType: "matching_features",
      useOnce: false,
      headings: [
        { id: "X", text: "A" },
        { id: "A", text: "Alpha target" },
      ],
      initialAnswers: ["A", ""],
    });

    const selectedText = container.querySelector(".matching-selected .matching-chip-text");
    expect(selectedText?.textContent).toContain("Alpha target");
  });

  it("does not style matching pool option as used when use_once is false", () => {
    const { container } = renderMatchingStep({
      groupType: "matching_features",
      useOnce: false,
      initialAnswers: ["A", ""],
    });

    const optionA = Array.from(container.querySelectorAll(".matching-options-pool .matching-chip"))
      .find((chip) => chip.querySelector(".matching-chip-id")?.textContent?.trim() === "A");
    expect(optionA).toBeTruthy();
    expect(optionA?.classList.contains("used")).toBe(false);
  });

  it("keeps distinct matching ids when option display text normalizes to the same value", () => {
    const { container } = renderMatchingStep({
      groupType: "matching_information",
      useOnce: true,
      headings: [
        { id: "A", text: "Alpha" },
        { id: "B", text: "Alpha." },
      ],
    });

    const dropzones = container.querySelectorAll(".matching-dropzone");
    expect(dropzones.length).toBe(2);

    dropMatchingToken(dropzones[0], "A");
    dropMatchingToken(dropzones[1], "B");

    expect(container.querySelectorAll(".matching-selected").length).toBe(2);
  });

  it("keeps multi-select choices distinct when option text is duplicated but ids differ", () => {
    const { container } = renderMultiSelectStep({
      options: [
        { id: "left-1", label: "A", text: "Same option text" },
        { id: "left-2", label: "B", text: "Same option text" },
      ],
    });

    const checkboxes = container.querySelectorAll('.exam-option-label input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);

    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(true);

    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
  });
});
