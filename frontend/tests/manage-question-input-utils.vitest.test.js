import { describe, expect, it } from "vitest";
import {
  buildMatchingInformationHeadingsFromRange,
  parseMatchingInformationRange,
} from "../src/features/admin/utils/manageQuestionInputUtils.js";

describe("manageQuestionInputUtils range parser", () => {
  it("parses alphabetic range A-G", () => {
    const result = parseMatchingInformationRange("A-G");
    expect(result.ok).toBe(true);
    expect(result.tokens).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });

  it("parses roman range I-VII", () => {
    const result = parseMatchingInformationRange("I-VII");
    expect(result.ok).toBe(true);
    expect(result.tokens).toEqual(["I", "II", "III", "IV", "V", "VI", "VII"]);
  });

  it("rejects reversed ranges", () => {
    expect(parseMatchingInformationRange("G-A")).toMatchObject({ ok: false });
    expect(parseMatchingInformationRange("VII-I")).toMatchObject({ ok: false });
  });

  it("rejects unsupported roman out of range", () => {
    const result = parseMatchingInformationRange("I-XI");
    expect(result.ok).toBe(false);
  });

  it("builds heading rows with identical id/text tokens", () => {
    const result = buildMatchingInformationHeadingsFromRange("A-C");
    expect(result).toEqual({
      ok: true,
      headings: [
        { id: "A", text: "A" },
        { id: "B", text: "B" },
        { id: "C", text: "C" },
      ],
    });
  });
});
