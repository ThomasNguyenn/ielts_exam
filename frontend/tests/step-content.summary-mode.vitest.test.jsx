import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StepContent from "../src/features/tests/components/exam/StepContent.jsx";

vi.mock("@/shared/components/HighlightableContent", async () => {
  const ReactRef = await vi.importActual("react");
  return {
    default: ReactRef.forwardRef(function MockHighlightableContent(
      { htmlContent = "", tagName = "div", onUpdateHtml, ...props },
      ref,
    ) {
      const safeTag = typeof tagName === "string" ? tagName : "div";
      return ReactRef.createElement(safeTag, {
        ...props,
        ref,
        dangerouslySetInnerHTML: { __html: htmlContent },
      });
    }),
    HighlightableWrapper: ({
      children,
      tagName = "div",
      onUpdateHtml,
      serializeHtmlForUpdate,
      ...props
    }) => {
      const safeTag = typeof tagName === "string" ? tagName : "div";
      const containerRef = ReactRef.useRef(null);
      return ReactRef.createElement(
        safeTag,
        {
          ...props,
          ref: containerRef,
          "data-testid": "mock-highlightable-wrapper",
          onClick: (event) => {
            if (typeof props.onClick === "function") props.onClick(event);
            if (!onUpdateHtml || !containerRef.current) return;
            const html =
              typeof serializeHtmlForUpdate === "function"
                ? serializeHtmlForUpdate(containerRef.current)
                : containerRef.current.innerHTML;
            onUpdateHtml(html);
          },
        },
        children,
      );
    },
    tokenizeHtml: (html = "") => html,
  };
});

afterEach(() => {
  cleanup();
});

function createSummaryStep({ options = [] } = {}) {
  const group = {
    type: "summary_completion",
    instructions: "Complete the summary",
    text: "The sample was [1] before it became [2].",
    options,
    questions: [
      { q_number: 1, text: "" },
      { q_number: 2, text: "" },
    ],
  };

  return {
    step: {
      type: "listening",
      startSlotIndex: 0,
      item: {
        _id: "section-1",
        content: "",
        question_groups: [group],
      },
    },
    slots: [
      { type: "summary_completion", q_number: 1, options, headings: [], option: [] },
      { type: "summary_completion", q_number: 2, options, headings: [], option: [] },
    ],
  };
}

function createGapFillStep() {
  const group = {
    type: "gap_fill",
    instructions: "Complete the notes",
    text: "The sample was [1] before it became [2].",
    options: [],
    questions: [
      { q_number: 1, text: "" },
      { q_number: 2, text: "" },
    ],
  };

  return {
    step: {
      type: "listening",
      startSlotIndex: 0,
      item: {
        _id: "section-1",
        content: "",
        question_groups: [group],
      },
    },
    slots: [
      { type: "gap_fill", q_number: 1, options: [], headings: [], option: [] },
      { type: "gap_fill", q_number: 2, options: [], headings: [], option: [] },
    ],
  };
}

function renderStepWithState({
  step,
  slots,
  answers = ["", ""],
  reviewMode = false,
  setAnswer = vi.fn(),
  reviewLookup = {},
  initialPassageStates = {},
} = {}) {
  function StatefulHarness() {
    const [passageStates, setPassageState] = React.useState(initialPassageStates);
    return (
      <StepContent
        step={step}
        slots={slots}
        answers={answers}
        setAnswer={setAnswer}
        passageStates={passageStates}
        setPassageState={setPassageState}
        showResult={false}
        listeningAudioUrl={null}
        onListeningAudioEnded={vi.fn()}
        reviewMode={reviewMode}
        reviewLookup={reviewLookup}
      />
    );
  }

  return render(
    <StatefulHarness />,
  );
}

function renderSummaryStep({
  options = [],
  answers = ["", ""],
  reviewMode = false,
  setAnswer = vi.fn(),
  reviewLookup = {},
  initialPassageStates = {},
} = {}) {
  const { step, slots } = createSummaryStep({ options });
  return renderStepWithState({
    step,
    slots,
    answers,
    reviewMode,
    setAnswer,
    reviewLookup,
    initialPassageStates,
  });
}

describe("StepContent summary_completion dual mode", () => {
  it("uses drag/drop mode when summary has valid options", () => {
    const { container } = renderSummaryStep({
      options: [
        { id: "", text: "" }, // invalid option should be ignored
        { id: "A", text: "heated" },
        { id: "", text: "cooled" }, // valid by text fallback
      ],
    });

    const dropzones = container.querySelectorAll(".summary-dropzone");
    const chips = container.querySelectorAll(".matching-chip");
    const textInputs = container.querySelectorAll("input.gap-fill-input");

    expect(dropzones.length).toBe(2);
    expect(chips.length).toBe(2);
    expect(textInputs.length).toBe(0);
  });

  it("falls back to note-completion text inputs when summary has no valid options", () => {
    const setAnswer = vi.fn();
    const { container } = renderSummaryStep({
      options: [{ id: "", text: " " }, {}],
      setAnswer,
    });

    const dropzones = container.querySelectorAll(".summary-dropzone");
    const textInputs = container.querySelectorAll("input.gap-fill-input");

    expect(dropzones.length).toBe(0);
    expect(textInputs.length).toBe(2);

    fireEvent.change(textInputs[0], { target: { value: "volcanic ash" } });
    expect(setAnswer).toHaveBeenCalledWith(0, "volcanic ash");
  });

  it("renders readonly fallback inputs in review mode when summary has no valid options", () => {
    const { container } = renderSummaryStep({
      options: [{ id: "", text: "" }],
      answers: ["alpha", "beta"],
      reviewMode: true,
    });

    const textInputs = container.querySelectorAll("input.gap-fill-input");
    expect(textInputs.length).toBe(2);
    expect(textInputs[0]).toHaveAttribute("disabled");
    expect(textInputs[1]).toHaveAttribute("disabled");
    expect(textInputs[0].value).toBe("alpha");
    expect(textInputs[1].value).toBe("beta");
  });

  it("keeps summary dropzones stable after highlight persistence updates", () => {
    const { container } = renderSummaryStep({
      options: [
        { id: "A", text: "heated" },
        { id: "B", text: "cooled" },
      ],
    });

    const wrapper = container.querySelector('[data-testid="mock-highlightable-wrapper"]');
    expect(wrapper).toBeTruthy();
    expect(container.querySelectorAll(".summary-dropzone").length).toBe(2);
    expect(container.querySelectorAll("input.gap-fill-input").length).toBe(0);

    fireEvent.click(wrapper);

    expect(container.querySelectorAll(".summary-dropzone").length).toBe(2);
    expect(container.querySelectorAll("input.gap-fill-input").length).toBe(0);
  });

  it("keeps gap-fill input count and values stable after highlight persistence updates", () => {
    const { step, slots } = createGapFillStep();
    const { container } = renderStepWithState({
      step,
      slots,
      answers: ["alpha", "beta"],
    });

    const wrapper = container.querySelector('[data-testid="mock-highlightable-wrapper"]');
    expect(wrapper).toBeTruthy();
    let textInputs = container.querySelectorAll("input.gap-fill-input");
    expect(textInputs.length).toBe(2);
    expect(textInputs[0].value).toBe("alpha");
    expect(textInputs[1].value).toBe("beta");

    fireEvent.click(wrapper);

    textInputs = container.querySelectorAll("input.gap-fill-input");
    expect(textInputs.length).toBe(2);
    expect(textInputs[0].value).toBe("alpha");
    expect(textInputs[1].value).toBe("beta");
  });

  it("does not recover malformed persisted data-question-index nodes into controls", () => {
    const { container } = renderSummaryStep({
      options: [
        { id: "A", text: "heated" },
        { id: "B", text: "cooled" },
      ],
      initialPassageStates: {
        "group_text_section-1_0": '<div data-question-index="7"></div>',
      },
    });

    expect(container.querySelectorAll(".summary-dropzone").length).toBe(0);
    expect(container.querySelectorAll("input.gap-fill-input").length).toBe(0);
  });

  it("keeps placeholder-driven control counts stable across multiple highlight persistence updates", () => {
    const { container } = renderSummaryStep({
      options: [
        { id: "A", text: "heated" },
        { id: "B", text: "cooled" },
      ],
    });

    expect(container.querySelectorAll(".summary-dropzone").length).toBe(2);
    expect(container.querySelectorAll("input.gap-fill-input").length).toBe(0);

    for (let iteration = 0; iteration < 3; iteration += 1) {
      const wrapper = container.querySelector('[data-testid="mock-highlightable-wrapper"]');
      expect(wrapper).toBeTruthy();
      fireEvent.click(wrapper);
      expect(container.querySelectorAll(".summary-dropzone").length).toBe(2);
      expect(container.querySelectorAll("input.gap-fill-input").length).toBe(0);
    }
  });
});
