import { describe, expect, it } from "vitest";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";

describe("pagination utils", () => {
  it("parses page/limit and computes skip", () => {
    const result = parsePagination(
      { page: "3", limit: "10" },
      { defaultPage: 1, defaultLimit: 20, maxLimit: 100 },
    );

    expect(result).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it("falls back to defaults for invalid values", () => {
    const result = parsePagination(
      { page: "-2", limit: "abc" },
      { defaultPage: 2, defaultLimit: 15, maxLimit: 100 },
    );

    expect(result).toEqual({ page: 2, limit: 15, skip: 15 });
  });

  it("caps limit at maxLimit", () => {
    const result = parsePagination(
      { page: "1", limit: "999" },
      { defaultPage: 1, defaultLimit: 20, maxLimit: 50 },
    );

    expect(result).toEqual({ page: 1, limit: 50, skip: 0 });
  });

  it("builds pagination metadata safely", () => {
    const meta = buildPaginationMeta({ page: 2, limit: 10, totalItems: 35 });

    expect(meta).toEqual({
      page: 2,
      limit: 10,
      totalItems: 35,
      totalPages: 4,
      hasPrevPage: true,
      hasNextPage: true,
    });
  });

  it("handles empty totals with one minimum page", () => {
    const meta = buildPaginationMeta({ page: 1, limit: 20, totalItems: 0 });

    expect(meta.totalPages).toBe(1);
    expect(meta.hasPrevPage).toBe(false);
    expect(meta.hasNextPage).toBe(false);
  });
});
