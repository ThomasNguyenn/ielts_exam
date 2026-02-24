import { describe, expect, it, vi } from "vitest";
import { parseModelJson, requestGeminiJsonWithFallback } from "../../utils/aiClient.js";

describe("parseModelJson", () => {
  it("parses fenced JSON payload", () => {
    const raw = "```json\n{\"ok\":true,\"value\":1}\n```";
    expect(parseModelJson(raw)).toEqual({ ok: true, value: 1 });
  });

  it("repairs common unescaped quote issues inside string values", () => {
    const raw =
      "{\"questions\":[{\"explanation\":\"Vi du \\\"already escaped\\\" va \"keyword\" trong doan\",\"passage_reference\":\"keyword\"}]}";
    const parsed = parseModelJson(raw);

    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0].explanation).toContain("\"keyword\"");
  });
});

describe("requestGeminiJsonWithFallback", () => {
  it("retries when model output is invalid JSON", async () => {
    const outputs = [
      "{\"questions\":[{\"group_index\":0 \"question_index\":0}]}",
      "{\"questions\":[{\"group_index\":0,\"question_index\":0,\"explanation\":\"ok\",\"passage_reference\":\"ref\"}]}",
    ];

    const generateContent = vi.fn(async () => ({
      response: Promise.resolve({
        text: () => outputs.shift(),
      }),
    }));

    const genAI = {
      getGenerativeModel: vi.fn(() => ({
        generateContent,
      })),
    };

    const result = await requestGeminiJsonWithFallback({
      genAI,
      models: ["gemini-2.0-flash"],
      contents: ["prompt"],
      generationConfig: { responseMimeType: "application/json" },
      timeoutMs: 1_000,
      maxAttempts: 2,
      baseDelayMs: 0,
    });

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(result.model).toBe("gemini-2.0-flash");
    expect(result.data.questions[0].question_index).toBe(0);
  });
});
