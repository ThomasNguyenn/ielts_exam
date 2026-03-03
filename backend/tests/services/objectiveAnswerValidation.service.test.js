import { describe, expect, it } from "vitest";
import {
  ObjectiveAnswerValidationError,
  assertObjectiveAnswerMappings,
  validateObjectiveAnswerMappings,
} from "../../services/objectiveAnswerValidation.service.js";

describe("objectiveAnswerValidation.service", () => {
  it("accepts valid label/id/text aliases for option-based groups", () => {
    const groups = [
      {
        type: "mult_choice",
        questions: [
          {
            q_number: 1,
            correct_answers: ["A"],
            option: [
              { label: "A", text: "North gate" },
              { label: "B", text: "South gate" },
            ],
          },
          {
            q_number: 2,
            correct_answers: ["South gate"],
            option: [
              { label: "A", text: "North gate" },
              { label: "B", text: "South gate" },
            ],
          },
        ],
      },
      {
        type: "matching_information",
        headings: [
          { id: "I", text: "Ocean currents" },
          { id: "II", text: "Ice sheets" },
        ],
        questions: [
          { q_number: 3, correct_answers: ["II"] },
          { q_number: 4, correct_answers: ["Ocean currents"] },
        ],
      },
    ];

    const issues = validateObjectiveAnswerMappings(groups);
    expect(issues).toEqual([]);
    expect(() => assertObjectiveAnswerMappings(groups)).not.toThrow();
  });

  it("rejects unresolved token for option-based group with structured details", () => {
    const groups = [
      {
        type: "matching_information",
        headings: [
          { id: "A", text: "Habitat loss" },
          { id: "B", text: "Policy reform" },
        ],
        questions: [
          { q_number: 7, correct_answers: ["Z"] },
        ],
      },
    ];

    const issues = validateObjectiveAnswerMappings(groups);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      groupIndex: 0,
      questionNumber: 7,
      groupType: "matching_information",
      invalidToken: "Z",
    });
    expect(issues[0].expectedOptions).toEqual(expect.arrayContaining(["A", "B", "Habitat loss"]));

    expect(() => assertObjectiveAnswerMappings(groups)).toThrow(ObjectiveAnswerValidationError);
  });

  it("does not validate non-option-based group types", () => {
    const groups = [
      {
        type: "short_answer",
        questions: [
          { q_number: 1, correct_answers: ["free text answer"] },
        ],
      },
    ];

    const issues = validateObjectiveAnswerMappings(groups);
    expect(issues).toEqual([]);
  });
});
