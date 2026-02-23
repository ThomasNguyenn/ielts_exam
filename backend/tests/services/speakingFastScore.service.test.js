import { describe, expect, it } from "vitest";
import {
  extractFeatures,
  computeProvisionalBandV1,
  buildProvisionalAnalysis,
} from "../../services/speakingFastScore.service.js";

const isHalfStep = (value) => {
  const scaled = Number(value) * 2;
  return Number.isFinite(scaled) && Math.abs(scaled - Math.round(scaled)) < 1e-9;
};

describe("speakingFastScore.service", () => {
  it("extracts deterministic features from transcript and metrics", () => {
    const transcript = "I actually think this is a good idea because people can learn faster. You know, it helps students.";
    const features = extractFeatures({
      transcript,
      metrics: {
        pauseCount: 6,
        totalPauseDuration: 4200,
      },
      wpm: 132,
      sttMeta: { duration: 24 },
    });

    expect(features.word_count).toBeGreaterThan(10);
    expect(features.wpm).toBe(132);
    expect(features.pause_count).toBe(6);
    expect(features.total_pause_ms).toBe(4200);
    expect(features.avg_pause_ms).toBe(700);
    expect(features.filler_count).toBeGreaterThanOrEqual(1);
    expect(features.lexical_diversity).toBeGreaterThan(0);
    expect(features.lexical_diversity).toBeLessThanOrEqual(1);
    expect(features.grammar_proxy_error_rate).toBeGreaterThanOrEqual(0);
  });

  it("computes provisional band in 0.5-step range", () => {
    const provisional = computeProvisionalBandV1({
      wpm: 125,
      pause_per_100_words: 10,
      filler_density: 0.025,
      grammar_proxy_error_rate: 0.3,
      lexical_diversity: 0.56,
      asr_confidence: 0.86,
    });

    expect(provisional.band_score).toBeGreaterThanOrEqual(0);
    expect(provisional.band_score).toBeLessThanOrEqual(9);
    expect(isHalfStep(provisional.band_score)).toBe(true);
    expect(isHalfStep(provisional.fluency_coherence)).toBe(true);
    expect(isHalfStep(provisional.grammatical_range)).toBe(true);
    expect(isHalfStep(provisional.lexical_resource)).toBe(true);
    expect(isHalfStep(provisional.pronunciation)).toBe(true);
  });

  it("uses fallback pronunciation logic when ASR confidence is missing", () => {
    const provisional = computeProvisionalBandV1({
      wpm: 118,
      pause_per_100_words: 9,
      filler_density: 0.02,
      grammar_proxy_error_rate: 0.28,
      lexical_diversity: 0.52,
      asr_confidence: null,
    });

    const analysis = buildProvisionalAnalysis(
      {
        wpm: 118,
        pause_count: 8,
        filler_density: 0.02,
        lexical_diversity: 0.52,
        grammar_proxy_error_rate: 0.28,
        asr_confidence: null,
        word_count: 120,
      },
      provisional,
    );

    expect(provisional.pronunciation).toBeGreaterThan(0);
    expect(analysis.pronunciation.feedback).toContain("ASR confidence: N/A");
    expect(analysis.band_score).toBe(provisional.band_score);
  });
});
