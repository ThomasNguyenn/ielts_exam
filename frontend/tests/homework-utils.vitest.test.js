import { describe, expect, it } from "vitest";
import {
  clampScore,
  groupAssignmentsByMonth,
  normalizeTaskForSubmit,
  toMonthValue,
} from "@/features/homework/pages/homework.utils";

describe("homework utils", () => {
  it("toMonthValue returns YYYY-MM format", () => {
    expect(toMonthValue(new Date("2026-03-20T00:00:00.000Z"))).toBe("2026-03");
  });

  it("groupAssignmentsByMonth groups and sorts months desc", () => {
    const grouped = groupAssignmentsByMonth([
      { _id: "a1", month: "2026-01" },
      { _id: "a2", month: "2026-03" },
      { _id: "a3", month: "2026-03" },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].month).toBe("2026-03");
    expect(grouped[0].assignments).toHaveLength(2);
  });

  it("normalizeTaskForSubmit sanitizes optional fields", () => {
    const normalized = normalizeTaskForSubmit(
      {
        title: "  Task title ",
        type: "note_task",
        min_words: "80",
        max_words: "120",
      },
      0,
    );

    expect(normalized.title).toBe("Task title");
    expect(normalized.min_words).toBe(80);
    expect(normalized.max_words).toBe(120);
    expect(normalized.resource_mode).toBe("internal");
  });

  it("clampScore handles range and invalid values", () => {
    expect(clampScore(11)).toBe(10);
    expect(clampScore(-3)).toBe(0);
    expect(clampScore("bad")).toBe("");
  });
});
