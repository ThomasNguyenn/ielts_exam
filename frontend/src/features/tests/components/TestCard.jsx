import { Link } from "react-router-dom";
import { ArrowRight, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import "./TestCard.css";

function getTestTypeLabel(type) {
  switch (type) {
    case "reading":
      return "Reading";
    case "listening":
      return "Listening";
    case "writing":
      return "Writing";
    case "speaking":
      return "Speaking";
    default:
      return "Test";
  }
}

function getTotalQuestions(test) {
  let total = 0;
  (test.reading_passages || []).forEach((item) => {
    total += item.questions?.length || 0;
  });
  (test.listening_sections || []).forEach((item) => {
    total += item.questions?.length || 0;
  });
  total += test.writing_tasks?.length || 0;
  return total;
}

function calculateIELTSBand(correctCount, testType) {
  const bands = {
    listening: [
      { min: 39, band: 9.0 },
      { min: 37, band: 8.5 },
      { min: 35, band: 8.0 },
      { min: 32, band: 7.5 },
      { min: 30, band: 7.0 },
      { min: 26, band: 6.5 },
      { min: 23, band: 6.0 },
      { min: 18, band: 5.5 },
      { min: 16, band: 5.0 },
      { min: 13, band: 4.5 },
      { min: 10, band: 4.0 },
      { min: 8, band: 3.5 },
      { min: 6, band: 3.0 },
      { min: 4, band: 2.5 },
      { min: 2, band: 2.0 },
      { min: 1, band: 1.0 },
      { min: 0, band: 0 },
    ],
    reading: [
      { min: 39, band: 9.0 },
      { min: 37, band: 8.5 },
      { min: 35, band: 8.0 },
      { min: 33, band: 7.5 },
      { min: 30, band: 7.0 },
      { min: 27, band: 6.5 },
      { min: 23, band: 6.0 },
      { min: 19, band: 5.5 },
      { min: 15, band: 5.0 },
      { min: 13, band: 4.5 },
      { min: 10, band: 4.0 },
      { min: 8, band: 3.5 },
      { min: 6, band: 3.0 },
      { min: 4, band: 2.5 },
      { min: 2, band: 2.0 },
      { min: 1, band: 1.0 },
      { min: 0, band: 0 },
    ],
  };

  const typeBands = bands[testType] || bands.reading;
  for (const rule of typeBands) {
    if (correctCount >= rule.min) return rule.band;
  }
  return 0;
}

function resolveAttemptPercentage(attempt) {
  if (!attempt?.total) return 0;
  if (typeof attempt.percentage === "number") return attempt.percentage;
  return Math.round((attempt.score / attempt.total) * 100);
}

export function TestCard({ test, attemptData, isLoggedIn }) {
  const type = test.type || "reading";
  const category = (test.category || "").trim() || "Uncategorized";
  const totalQuestions = getTotalQuestions(test);
  const bestAttempt = attemptData?.best || null;
  const latestAttempt = attemptData?.latest || null;
  const canShowBand = bestAttempt?.total && (type === "reading" || type === "listening");
  const band = canShowBand ? calculateIELTSBand(bestAttempt.score, type) : null;

  return (
    <article className="tc">
      <h3 className="tc-title">{test.title}</h3>

      <div className="tc-chips">
        <Badge className={`tc-type-chip tc-type-chip--${type}`}>{getTestTypeLabel(type)}</Badge>
        <Badge variant="outline" className="tc-category-chip">
          {category}
        </Badge>
        {canShowBand ? <Badge className="tc-band-chip">Band {band.toFixed(1)}</Badge> : null}
      </div>

      <p className="tc-meta-line">
        {totalQuestions} questions
      </p>

      {isLoggedIn ? (
        <div className="tc-attempt-box">
          <p>
            Latest:{" "}
            {latestAttempt?.total
              ? `${latestAttempt.score}/${latestAttempt.total} (${resolveAttemptPercentage(latestAttempt)}%)`
              : `0/${totalQuestions} (0%)`}
          </p>
          <p>
            Best:{" "}
            {bestAttempt?.total
              ? `${bestAttempt.score}/${bestAttempt.total} (${resolveAttemptPercentage(bestAttempt)}%)`
              : `0/${totalQuestions} (0%)`}
          </p>
        </div>
      ) : null}

      <div className="tc-actions">
        <Link to={`/tests/${test._id}`} className="tc-btn-primary">
          Start test
          <ArrowRight size={14} />
        </Link>
        {isLoggedIn ? (
          <Link to={`/tests/${test._id}/history`} className="tc-btn-secondary">
            <Layers size={14} />
            History
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function PartCard({ part }) {
  const type = part.type || "reading";

  return (
    <article className="tc">
      <h3 className="tc-title">{part.title}</h3>

      <div className="tc-chips">
        <Badge className={`tc-type-chip tc-type-chip--${type}`}>{part.label}</Badge>
        <Badge variant="outline" className="tc-category-chip">
          {part.category}
        </Badge>
      </div>

      <p className="tc-part-origin">
        From <strong>{part.testTitle}</strong>
      </p>

      <div className="tc-actions">
        <Link
          to={`/tests/${part.testId}/exam?part=${part.partIndex}&mode=single`}
          className="tc-btn-primary"
        >
          Start part
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
