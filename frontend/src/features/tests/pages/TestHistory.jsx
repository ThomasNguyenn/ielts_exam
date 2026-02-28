import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import "./TestHistory.css";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function formatDateParts(value) {
  if (!value) return { date: "--", time: "--" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "--", time: "--" };

  const year = date.getFullYear().toString().slice(-2);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");

  return {
    date: `${day}/${month}/${year}`,
    time: `${hours}:${minutes}:${seconds}`,
  };
}

function formatDuration(ms) {
  const value = toNumber(ms, 0);
  if (value <= 0) return "--";
  const totalSeconds = Math.floor(value / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

function formatOneDecimal(value) {
  const parsed = toNumber(value, 0);
  return parsed.toFixed(1);
}

function resolveAttempt(attempt) {
  const score = toNumber(attempt?.score, 0);
  const total = toNumber(attempt?.total, 0);
  const skipped = toNumber(attempt?.skipped, 0);
  const wrong =
    typeof attempt?.wrong === "number"
      ? toNumber(attempt.wrong, 0)
      : Math.max(0, total - score - skipped);
  const pct =
    typeof attempt?.percentage === "number"
      ? Math.round(toNumber(attempt.percentage, 0))
      : total > 0
        ? Math.round((score / total) * 100)
        : 0;

  return {
    ...attempt,
    score,
    total,
    calculatedWrong: wrong,
    calculatedSkipped: skipped,
    pct: clamp(pct, 0, 100),
  };
}

export default function TestHistory() {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [testRes, attemptsRes] = await Promise.all([
          api.getTestById(id),
          api.getMyTestHistory(id),
        ]);

        if (!mounted) return;
        setTest(testRes?.data || null);
        setAttempts(Array.isArray(attemptsRes?.data) ? attemptsRes.data : []);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError?.message || "Failed to load history.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const scoredAttempts = useMemo(
    () =>
      attempts
        .map(resolveAttempt)
        .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)),
    [attempts],
  );

  const isWriting = String(test?.type || "").toLowerCase() === "writing";

  const summary = useMemo(() => {
    const totalAttempts = scoredAttempts.length;
    const latest = scoredAttempts[0] || null;
    const latestDate = latest?.submitted_at ? formatDateParts(latest.submitted_at).date : "--";

    if (isWriting) {
      const bandScores = scoredAttempts
        .map((attempt) => toNumber(attempt.score, NaN))
        .filter((value) => Number.isFinite(value));
      const bestBand = bandScores.length ? Math.max(...bandScores) : 0;
      const avgBand = bandScores.length
        ? bandScores.reduce((acc, current) => acc + current, 0) / bandScores.length
        : 0;
      const latestBand = latest ? toNumber(latest.score, 0) : 0;

      return {
        totalAttempts: `${totalAttempts}`,
        best: `Band ${formatOneDecimal(bestBand)}`,
        average: `Band ${formatOneDecimal(avgBand)}`,
        latest: latest ? `Band ${formatOneDecimal(latestBand)}` : "--",
        latestDate,
      };
    }

    const percentages = scoredAttempts.map((attempt) => toNumber(attempt.pct, 0));
    const bestPct = percentages.length ? Math.max(...percentages) : 0;
    const avgPct = percentages.length
      ? Math.round(percentages.reduce((acc, current) => acc + current, 0) / percentages.length)
      : 0;
    const latestPct = latest ? toNumber(latest.pct, 0) : 0;

    return {
      totalAttempts: `${totalAttempts}`,
      best: `${bestPct}%`,
      average: `${avgPct}%`,
      latest: latest ? `${latestPct}%` : "--",
      latestDate,
    };
  }, [isWriting, scoredAttempts]);

  const testTitle = String(test?.title || "Test History");
  const typeLabel = test?.type
    ? `${String(test.type).charAt(0).toUpperCase()}${String(test.type).slice(1)} Test`
    : "Practice Test";

  if (loading) {
    return (
      <div className="page test-history">
        <section className="th-state-card">
          <span className="material-symbols-outlined">hourglass_top</span>
          <h2>Loading history</h2>
          <p>Please wait while we fetch your latest attempts.</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page test-history">
        <section className="th-state-card th-state-card--error">
          <span className="material-symbols-outlined">error</span>
          <h2>Unable to load test history</h2>
          <p>{error}</p>
          <div className="th-state-actions">
            <Link to="/tests" className="th-btn th-btn--ghost">
              Back to tests
            </Link>
            <Link to={`/tests/${id}`} className="th-btn th-btn--primary">
              Start this test
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page test-history">
      <section className="th-hero-card">
        <div className="th-hero-top">
          <Link to="/tests" className="th-back-link">
            <span className="material-symbols-outlined">arrow_back</span>
            All tests
          </Link>
          <span className={`th-test-type ${isWriting ? "writing" : "objective"}`}>{typeLabel}</span>
        </div>

        <div className="th-hero-main">
          <div className="th-hero-content">
            <h1>{testTitle}</h1>
            <p>Review every submission, spot patterns, and plan your next improvement cycle.</p>
          </div>
          <div className="th-hero-actions">
            <Link to={`/tests/${id}`} className="th-btn th-btn--primary">
              Retake test
            </Link>
            <Link to="/tests" className="th-btn th-btn--ghost">
              Browse tests
            </Link>
          </div>
        </div>

        <div className="th-kpi-grid">
          <article className="th-kpi-card">
            <div className="th-kpi-icon">
              <span className="material-symbols-outlined">history</span>
            </div>
            <p>Total Attempts</p>
            <strong>{summary.totalAttempts}</strong>
          </article>
          <article className="th-kpi-card">
            <div className="th-kpi-icon">
              <span className="material-symbols-outlined">military_tech</span>
            </div>
            <p>Best Result</p>
            <strong>{summary.best}</strong>
          </article>
          <article className="th-kpi-card">
            <div className="th-kpi-icon">
              <span className="material-symbols-outlined">stacked_line_chart</span>
            </div>
            <p>Average Result</p>
            <strong>{summary.average}</strong>
          </article>
          <article className="th-kpi-card">
            <div className="th-kpi-icon">
              <span className="material-symbols-outlined">schedule</span>
            </div>
            <p>Latest</p>
            <strong>{summary.latest}</strong>
            <span>{summary.latestDate}</span>
          </article>
        </div>
      </section>

      {scoredAttempts.length === 0 ? (
        <section className="th-state-card">
          <span className="material-symbols-outlined">assignment</span>
          <h2>No attempts yet</h2>
          <p>Start your first attempt and this page will track all history for this test.</p>
          <div className="th-state-actions">
            <Link to={`/tests/${id}`} className="th-btn th-btn--primary">
              Start this test
            </Link>
          </div>
        </section>
      ) : (
        <section className="th-table-card">
          <div className="th-table-head">
            <h2>Attempt Timeline</h2>
            <span>{scoredAttempts.length} records</span>
          </div>

          <div className="th-table-scroll">
            <table className="th-table">
              <thead>
                <tr>
                  <th className="left">Attempt</th>
                  <th>Submitted</th>
                  {isWriting ? (
                    <>
                      <th>Task 1</th>
                      <th>Task 2</th>
                      <th>Overall Band</th>
                      <th className="left">Feedback</th>
                    </>
                  ) : (
                    <>
                      <th>Duration</th>
                      <th>Total</th>
                      <th>Correct</th>
                      <th>Wrong</th>
                      <th>Skipped</th>
                      <th className="left">Accuracy</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {scoredAttempts.map((attempt, index) => {
                  const { date, time } = formatDateParts(attempt.submitted_at);
                  const writingDetails = attempt.writing_details || {};

                  return (
                    <tr key={attempt._id || `${attempt.submitted_at || "attempt"}-${index}`}>
                      <td className="left">
                        <div className="th-attempt-id">Attempt #{scoredAttempts.length - index}</div>
                        <div className="th-attempt-subtitle">{testTitle}</div>
                      </td>
                      <td>
                        <div className="th-date">{date}</div>
                        <div className="th-time">{time}</div>
                      </td>

                      {isWriting ? (
                        <>
                          <td>
                            <span className="th-pill th-pill--neutral">{writingDetails.task1_score ?? "--"}</span>
                          </td>
                          <td>
                            <span className="th-pill th-pill--neutral">{writingDetails.task2_score ?? "--"}</span>
                          </td>
                          <td>
                            <span className="th-pill th-pill--primary">{attempt.score ?? "--"}</span>
                          </td>
                          <td className="left th-feedback-cell">
                            {writingDetails.feedback ? (
                              <p className="th-feedback-text">{writingDetails.feedback}</p>
                            ) : (
                              <span className="th-feedback-empty">No feedback yet</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{formatDuration(attempt.time_taken_ms)}</td>
                          <td>{attempt.total}</td>
                          <td>
                            <span className="th-pill th-pill--correct">{attempt.score}</span>
                          </td>
                          <td>
                            <span className="th-pill th-pill--wrong">{attempt.calculatedWrong}</span>
                          </td>
                          <td>
                            <span className="th-pill th-pill--skipped">{attempt.calculatedSkipped}</span>
                          </td>
                          <td className="left th-accuracy-cell">
                            <div className="th-accuracy-value">{attempt.pct}%</div>
                            <div className="th-accuracy-track">
                              <div className="th-accuracy-fill" style={{ width: `${attempt.pct}%` }} />
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
