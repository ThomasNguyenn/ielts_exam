import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "@/shared/api/client";
import ExamEngine from "@/features/tests/components/exam-engine/Exam";

export default function StandaloneReadingExam() {
  const { passageId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [passage, setPassage] = useState(null);
  const [submittedSummary, setSubmittedSummary] = useState(null);

  useEffect(() => {
    if (!passageId) return;

    let isMounted = true;
    setLoading(true);
    setLoadError(null);

    api
      .getPassageById(passageId)
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data || res;
        if (!data) {
          setLoadError("Passage not found.");
          return;
        }
        setPassage(data);
      })
      .catch((error) => {
        if (!isMounted) return;
        setLoadError(error.message || "Failed to load passage.");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [passageId]);

  const handleSubmit = (answers) => {
    if (!passage) return;

    let total = 0;
    let answered = 0;

    (passage.question_groups || []).forEach((group) => {
      (group.questions || []).forEach((question, index) => {
        total += 1;
        const id = String(question?.id ?? question?.q_number ?? index + 1);
        const raw = answers[id];
        const value = Array.isArray(raw) ? raw.join(", ").trim() : String(raw || "").trim();
        if (value) answered += 1;
      });
    });

    setSubmittedSummary({
      total,
      answered,
    });
  };

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading passage practice…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page">
        <p className="error">{loadError}</p>
        <button type="button" className="btn" onClick={() => navigate("/tests")}>
          Back to tests
        </button>
      </div>
    );
  }

  if (!passage) {
    return (
      <div className="page">
        <p className="muted">Passage not found.</p>
        <Link to="/tests">Back to tests</Link>
      </div>
    );
  }

  const exam = {
    module: passage.title || "Standalone Reading Passage",
    sections: [
      {
        section_number: 1,
        passage: passage.content,
        audio_url: null,
        question_groups: passage.question_groups || [],
      },
    ],
  };

  return (
    <div className="page">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0 }}>{passage.title}</h1>
            <p className="muted" style={{ marginTop: "0.25rem" }}>
              Standalone reading practice
            </p>
          </div>
          <Link to="/tests" className="btn-exit-test">
            Back to tests
          </Link>
        </header>

        {submittedSummary ? (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              background: "#ecfdf3",
              border: "1px solid #16a34a33",
              color: "#166534",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span>
              You answered <strong>{submittedSummary.answered}</strong> out of{" "}
              <strong>{submittedSummary.total}</strong> questions.
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSubmittedSummary(null)}
            >
              Try again
            </button>
          </div>
        ) : null}

        <ExamEngine exam={exam} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}

