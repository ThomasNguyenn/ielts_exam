import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "@/shared/api/client";
import ExamEngine from "@/features/tests/components/exam-engine/Exam";

export default function StandaloneListeningExam() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [section, setSection] = useState(null);
  const [submittedSummary, setSubmittedSummary] = useState(null);

  useEffect(() => {
    if (!sectionId) return;

    let isMounted = true;
    setLoading(true);
    setLoadError(null);

    api
      .getSectionById(sectionId)
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data || res;
        if (!data) {
          setLoadError("Section not found.");
          return;
        }
        setSection(data);
      })
      .catch((error) => {
        if (!isMounted) return;
        setLoadError(error.message || "Failed to load listening section.");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sectionId]);

  const handleSubmit = (answers) => {
    if (!section) return;

    let total = 0;
    let answered = 0;

    (section.question_groups || []).forEach((group) => {
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
        <p className="muted">Loading listening practice…</p>
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

  if (!section) {
    return (
      <div className="page">
        <p className="muted">Listening section not found.</p>
        <Link to="/tests">Back to tests</Link>
      </div>
    );
  }

  const exam = {
    module: section.title || "Standalone Listening Section",
    sections: [
      {
        section_number: 1,
        passage: section.content,
        audio_url: section.audio_url || null,
        question_groups: section.question_groups || [],
      },
    ],
  };

  return (
    <div className="page">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0 }}>{section.title}</h1>
            <p className="muted" style={{ marginTop: "0.25rem" }}>
              Standalone listening practice
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
              background: "#eff6ff",
              border: "1px solid #3b82f633",
              color: "#1d4ed8",
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

