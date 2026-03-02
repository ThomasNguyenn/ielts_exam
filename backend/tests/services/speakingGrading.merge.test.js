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

  it("calibrates down overly high grammar/pronunciation when error evidence is strong", () => {
    const merged = mergeSpeakingPhaseAnalyses({
      phase1: {
        lexical_resource: { score: 7.0, feedback: "ok" },
        grammatical_range: { score: 8.0, feedback: "too high" },
        grammar_corrections: [
          { original: "i is", corrected: "i am", reason: "sva" },
          { original: "he are", corrected: "he is", reason: "sva" },
          { original: "i go yesterday", corrected: "i went yesterday", reason: "tense" },
        ],
        error_logs: [
          { code: "S-G1", snippet: "i go yesterday", explanation: "tense" },
          { code: "S-G2", snippet: "he are", explanation: "agreement" },
        ],
      },
      phase2: {
        fluency_coherence: { score: 7.0, feedback: "ok" },
        pronunciation: { score: 8.0, feedback: "too high" },
        error_logs: [
          { code: "S-P1", snippet: "important", explanation: "stress" },
          { code: "S-P3", snippet: "think", explanation: "sound substitution" },
        ],
        pronunciation_heatmap: [
          { word: "important", status: "error", note: "" },
          { word: "think", status: "error", note: "" },
          { word: "although", status: "needs_work", note: "" },
          { word: "because", status: "needs_work", note: "" },
          { word: "actually", status: "needs_work", note: "" },
          { word: "different", status: "needs_work", note: "" },
          { word: "people", status: "needs_work", note: "" },
          { word: "should", status: "needs_work", note: "" },
          { word: "improve", status: "needs_work", note: "" },
          { word: "quality", status: "needs_work", note: "" },
        ],
        focus_areas: [
          { title: "Word Stress", priority: "high", description: "x" },
          { title: "Sound Substitution", priority: "high", description: "x" },
        ],
      },
      provisional: {
        grammatical_range: { score: 6.0, feedback: "p" },
        pronunciation: { score: 6.0, feedback: "p" },
      },
      topicPart: 3,
      topicPrompt: "Topic",
      transcript: "I is agree because he are good and I go yesterday.",
      metrics: { wpm: 120, pauses: { pauseCount: 4 } },
    });

    expect(merged.grammatical_range.score).toBeLessThanOrEqual(6.5);
    expect(merged.pronunciation.score).toBeLessThanOrEqual(7.0);
  });

  it("injects grammar proxy findings when AI misses obvious grammar errors", () => {
    const merged = mergeSpeakingPhaseAnalyses({
      phase1: {
        lexical_resource: { score: 6.5, feedback: "ok" },
        grammatical_range: { score: 8.0, feedback: "too high" },
        grammar_corrections: [],
        error_logs: [],
      },
      phase2: {
        fluency_coherence: { score: 6.0, feedback: "ok" },
        pronunciation: { score: 6.5, feedback: "ok" },
        error_logs: [],
      },
      provisional: {
        grammatical_range: { score: 6.0, feedback: "p" },
      },
      topicPart: 1,
      topicPrompt: "Topic",
      transcript: "I is very happy and he are my friend. There is many people in the room.",
      metrics: { wpm: 110, pauses: { pauseCount: 5 } },
    });

    expect(merged.grammatical_range.score).toBeLessThanOrEqual(6.5);
    expect(Array.isArray(merged.grammar_corrections)).toBe(true);
    expect(merged.grammar_corrections.length).toBeGreaterThan(0);
    expect(merged.error_logs.some((log) => String(log?.code || "").startsWith("S-G"))).toBe(true);
  });

  it("caps pronunciation when phase2 falls back and ASR confidence is low", () => {
    const merged = mergeSpeakingPhaseAnalyses({
      phase1: {
        lexical_resource: { score: 6.5, feedback: "ok" },
        grammatical_range: { score: 6.5, feedback: "ok" },
      },
      phase2: {
        fluency_coherence: { score: 6.0, feedback: "ok" },
        pronunciation: { score: 8.0, feedback: "high but likely wrong" },
        error_logs: [],
        pronunciation_heatmap: [],
        focus_areas: [],
      },
      phase2Source: "provisional:formula_v1",
      provisional: {
        pronunciation: {
          score: 7.5,
          feedback: "ASR confidence: 62%. Pronunciation score is provisional.",
        },
      },
      topicPart: 2,
      topicPrompt: "Topic",
      transcript: "Sample transcript",
      metrics: { wpm: 95, pauses: { pauseCount: 12 } },
    });

    expect(merged.pronunciation.score).toBeLessThanOrEqual(6.5);
  });
});
