import { describe, expect, it } from "vitest";
import {
  createTaxonomyErrorLog,
  getFallbackErrorCode,
  isValidErrorCodeForSkill,
  normalizeQuestionType,
  normalizeSkillDomain,
  resolveCognitiveSkill,
} from "../../services/taxonomy.registry.js";
import { classifyObjectiveHeuristic } from "../../services/taxonomy.service.js";

describe("taxonomy.registry", () => {
  it("normalizes skill domain and question type aliases", () => {
    expect(normalizeSkillDomain("Reading")).toBe("reading");
    expect(normalizeQuestionType("TRUE_FALSE_NOTGIVEN")).toBe("true_false_not_given");
    expect(normalizeQuestionType("flowchart-completion")).toBe("flow_chart_completion");
    expect(normalizeQuestionType("multiple choice single")).toBe("multiple_choice");
  });

  it("validates error codes by skill and returns fallback codes", () => {
    expect(isValidErrorCodeForSkill("R-C3", "reading")).toBe(true);
    expect(isValidErrorCodeForSkill("R-C3", "listening")).toBe(false);
    expect(isValidErrorCodeForSkill("W2-G1", "writing")).toBe(true);
    expect(getFallbackErrorCode("speaking")).toBe("S-UNCLASSIFIED");
  });

  it("resolves cognitive skill from code first, then from question type", () => {
    const fromCode = resolveCognitiveSkill({
      skillDomain: "reading",
      questionType: "multiple_choice",
      errorCode: "R-A1",
    });
    const fromType = resolveCognitiveSkill({
      skillDomain: "listening",
      questionType: "map_labeling",
      errorCode: null,
    });

    expect(fromCode).toBe("R1. Literal Comprehension");
    expect(fromType).toBe("L2. Word Boundary Detection");
  });

  it("creates normalized taxonomy log with metadata and validated code", () => {
    const log = createTaxonomyErrorLog({
      skillDomain: "writing",
      taskType: "task2",
      errorCode: "W2-G1",
      textSnippet: "People is prefer",
      explanation: "Loi grammar",
      detectionMethod: "llm",
      confidence: 0.77,
      secondaryErrorCodes: ["W2-L1", "INVALID"],
    });

    expect(log.error_code).toBe("W2-G1");
    expect(log.skill_domain).toBe("writing");
    expect(log.question_type).toBe("task2");
    expect(log.taxonomy_dimension).toBe("grammar");
    expect(log.detection_method).toBe("llm");
    expect(log.confidence).toBe(0.77);
    expect(log.secondary_error_codes).toEqual(["W2-L1"]);
    expect(log.taxonomy_version).toBe("ielts_taxonomy_v1");
  });

  it("falls back to skill unclassified code when code is invalid", () => {
    const log = createTaxonomyErrorLog({
      skillDomain: "speaking",
      taskType: "part2",
      errorCode: "R-C3",
      textSnippet: "uhm...",
    });

    expect(log.error_code).toBe("S-UNCLASSIFIED");
    expect(log.skill_domain).toBe("speaking");
    expect(log.question_type).toBe("part2");
  });
});

describe("taxonomy.service heuristic classifier", () => {
  it("classifies blank reading completion as incomplete answer", () => {
    const result = classifyObjectiveHeuristic({
      skillDomain: "reading",
      question: {
        type: "note_completion",
        your_answer: "",
        correct_answer: "library",
      },
    });

    expect(result?.errorCode).toBe("R-A6");
  });

  it("classifies plural mismatch and TFNG confusion", () => {
    const pluralResult = classifyObjectiveHeuristic({
      skillDomain: "reading",
      question: {
        type: "short_answer",
        your_answer: "student",
        correct_answer: "students",
      },
    });

    const tfngResult = classifyObjectiveHeuristic({
      skillDomain: "reading",
      question: {
        type: "true_false_not_given",
        your_answer: "true",
        correct_answer: "not given",
      },
    });

    expect(pluralResult?.errorCode).toBe("R-A2");
    expect(tfngResult?.errorCode).toBe("R-T3");
  });
});
