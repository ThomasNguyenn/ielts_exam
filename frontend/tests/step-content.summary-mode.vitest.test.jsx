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
    HighlightableWrapper: ({ children, tagName = "div", onUpdateHtml, ...props }) =>
      ReactRef.createElement(tagName, props, children),
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

function renderSummaryStep({
  options = [],
  answers = ["", ""],
  reviewMode = false,
  setAnswer = vi.fn(),
  reviewLookup = {},
} = {}) {
  const { step, slots } = createSummaryStep({ options });
  return render(
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
      reviewMode={reviewMode}
      reviewLookup={reviewLookup}
    />,
  );
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
});
