import { describe, expect, it } from "vitest";
import { mergeSpeakingPhaseAnalyses } from "../../services/speakingGrading.service.js";

describe("mergeSpeakingPhaseAnalyses", () => {
  it("merges phase1 and phase2 criteria and computes half-step band", () => {
    const merged = mergeSpeakingPhaseAnalyses({
      phase1: {
        lexical_resource: { score: 6.0, feedback: "Lexical feedback" },
        grammatical_range: { score: 6.5, feedback: "Grammar feedback" },
        sample_answer: "Sample answer",
        error_logs: [{ code: "S-L1", snippet: "good good", explanation: "repetition" }],
      },
      phase2: {
        fluency_coherence: { score: 6.5, feedback: "Fluency feedback" },
        pronunciation: { score: 7.0, feedback: "Pronunciation feedback" },
        error_logs: [{ code: "S-P1", snippet: "important", explanation: "stress" }],
      },
      provisional: {
        band_score: 5.5,
      },
      topicPart: 2,
      topicPrompt: "Describe a memorable event",
      transcript: "I talked about my trip.",
      metrics: { wpm: 120, pauses: { pauseCount: 5 } },
    });

    expect(merged.lexical_resource.score).toBe(6);
    expect(merged.grammatical_range.score).toBe(6.5);
    expect(merged.fluency_coherence.score).toBe(6.5);
    expect(merged.pronunciation.score).toBe(7);
    expect(merged.band_score).toBe(6.5);
    expect(Array.isArray(merged.error_logs)).toBe(true);
    expect(merged.error_logs).toHaveLength(2);
  });

  it("dedupes error logs by code and snippet", () => {
    const merged = mergeSpeakingPhaseAnalyses({
      phase1: {
        lexical_resource: { score: 5.5, feedback: "x" },
        grammatical_range: { score: 5.5, feedback: "x" },
        error_logs: [
          { code: "S-G1", snippet: "I go yesterday", explanation: "tense" },
          { code: "S-G1", snippet: "I go yesterday", explanation: "tense duplicate" },
        ],
      },
      phase2: {
        fluency_coherence: { score: 5.5, feedback: "x" },
        pronunciation: { score: 5.5, feedback: "x" },
        error_logs: [{ code: "S-G1", snippet: "I go yesterday", explanation: "still duplicate" }],
      },
      provisional: {},
      topicPart: 1,
      topicPrompt: "Topic",
      transcript: "I go yesterday",
      metrics: { wpm: 100, pauses: { pauseCount: 3 } },
    });

    expect(merged.error_logs).toHaveLength(1);
    expect(String(merged.error_logs[0].code || "").toUpperCase()).toBe("S-G1");
  });

  it("falls back to provisional score when phase score is missing/zero-like", () => {
    const merged = mergeSpeakingPhaseAnalyses({
      phase1: {
        lexical_resource: { score: "", feedback: "missing score" },
        grammatical_range: { score: null, feedback: "missing score" },
      },
      phase2: {
        fluency_coherence: { score: 6.5, feedback: "ok" },
        pronunciation: { score: "N/A", feedback: "missing score" },
      },
      provisional: {
        lexical_resource: { score: 6.0, feedback: "p lex" },
        grammatical_range: { score: 5.5, feedback: "p gr" },
        pronunciation: { score: 6.0, feedback: "p pron" },
      },
      topicPart: 2,
      topicPrompt: "Describe a place",
      transcript: "Sample transcript",
      metrics: { wpm: 120, pauses: { pauseCount: 4 } },
    });

    expect(merged.lexical_resource.score).toBe(6);
    expect(merged.grammatical_range.score).toBe(5.5);
    expect(merged.fluency_coherence.score).toBe(6.5);
    expect(merged.pronunciation.score).toBe(6);
  });
});
