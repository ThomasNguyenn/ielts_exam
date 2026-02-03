import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import parse from 'html-react-parser';
import { api } from '../api/client';

/** Build flat list of question slots in exam order */
function buildQuestionSlots(exam) {
  const slots = [];
  const pushSlots = (items) => {
    if (!items) return;
    for (const item of items) {
      for (const group of item.question_groups || []) {
        for (const q of group.questions || []) {
          slots.push({
            type: group.type,
            instructions: group.instructions,
            headings: group.headings || [],
            q_number: q.q_number,
            text: q.text,
            option: q.option || [],
          });
        }
      }
    }
  };
  pushSlots(exam.reading);
  pushSlots(exam.listening);
  return slots;
}

/** Build steps: one per passage/section with slot range */
function buildSteps(exam) {
  const steps = [];
  let slotIndex = 0;
  const pushStep = (type, label, item) => {
    const start = slotIndex;
    for (const group of item.question_groups || []) {
      slotIndex += (group.questions || []).length;
    }
    steps.push({ type, label, item, startSlotIndex: start, endSlotIndex: slotIndex });
  };
  (exam.reading || []).forEach((p, i) => pushStep('reading', `Passage ${i + 1}`, p));
  (exam.listening || []).forEach((s, i) => pushStep('listening', `Section ${i + 1}`, s));
  return steps;
}

function QuestionInput({ slot, value, onChange, index }) {
  const id = `q-${index}`;
  
  // 1. Định nghĩa logic chung (Binding dữ liệu)
  const common = { 
    value: value || '', 
    onChange: (e) => onChange(e.target.value),
    disabled: false // Có thể thêm prop này nếu muốn khóa input sau khi nộp
  };

  // --- TRẮC NGHIỆM (Radio) ---
  if (slot.type === 'mult_choice' || slot.type === 'true_false_notgiven') {
    return (
      <div className="exam-options">
        {(slot.option || []).filter((o) => o.text).map((opt) => (
          <label key={opt.label} className="exam-option-label">
            <input
              type="radio"
              name={id}
              checked={(value || '').trim() === (opt.text || '').trim()}
              onChange={() => onChange(opt.text)}
            />
            <span>{opt.label}. {opt.text}</span>
          </label>
        ))}
      </div>
    );
  }

  // --- ĐIỀN TỪ (Gap Fill) - ĐÃ SỬA ---
  if (slot.type === 'gap_fill') {
    return (
      <input 
        type="text" 
        className="exam-input text-center font-bold text-blue-700 border-b-2 border-gray-300 focus:border-blue-500 outline-none px-2" 
        placeholder={`(${index + 1})`} 
        autoComplete="off"
        // ✅ QUAN TRỌNG NHẤT: Phải có dòng này thì React mới lưu được đáp án
        {...common} 
      />
    );
  }

  // --- NỐI TIÊU ĐỀ (Dropdown) ---
  if (slot.type === 'matching_headings' || slot.type === 'matching_features') {
    const options = slot.headings || [];
    return (
      <select className="exam-select" {...common}>
        <option value="">-- Choose --</option>
        {options.map((h) => (
          <option key={h.id} value={h.id}>{h.id}. {h.text}</option>
        ))}
      </select>
    );
  }

  // Mặc định (Fallback)
  return <input type="text" className="exam-input" placeholder="Your answer" {...common} />;
}

/** One step: passage/section content + its questions (with slot indices) */
function StepContent({ step, slots, answers, setAnswer }) {
  const { item, startSlotIndex, endSlotIndex, type } = step;
  const isReading = type === 'reading';
  let slotIndex = startSlotIndex;

  const questionsBlock = (
    <div className="exam-step-questions">
      {(item.question_groups || []).map((group, groupIdx) => (
        <div key={group.type + slotIndex + groupIdx} className="exam-group">
          
          {/* SỬA 1: Instruction hiển thị xuống dòng đúng */}
          {group.instructions && (
            <div 
              className="exam-instructions"
              style={{ whiteSpace: 'pre-line' }} // Style nhanh để fix lỗi xuống dòng
            >
              {group.instructions}
            </div>
          )}

          {(group.questions || []).map((q) => {
            const slot = slots[slotIndex];
            const currentIndex = slotIndex;
            slotIndex++; // Tăng index cho câu tiếp theo

            // --- LOGIC GAP FILL MỚI (Dùng html-react-parser) ---
            if (group.type === 'gap_fill') {
              const gapRegex = /_{3,}|\.{3,}/; // Tìm ____ hoặc ....
              
              // Cấu hình Parser để thay thế "___" bằng Input
              const parseOptions = {
                replace: (domNode) => {
                  // Chỉ xử lý nếu là Text Node và có chứa dấu gạch dưới
                  if (domNode.type === 'text' && gapRegex.test(domNode.data)) {
                    const parts = domNode.data.split(gapRegex);
                    return (
                      <>
                        {parts.map((part, i) => (
                          <span key={i}>
                            {part}
                            {/* Nếu chưa phải phần cuối -> Chèn Input vào giữa */}
                            {i < parts.length - 1 && (
                              <span className="inline-input-wrapper mx-1" style={{ display: 'inline-block', margin: '0 5px' }}>
                                <QuestionInput
                                  slot={slot}
                                  value={answers[currentIndex]}
                                  onChange={(v) => setAnswer(currentIndex, v)}
                                  index={currentIndex}
                                />
                              </span>
                            )}
                          </span>
                        ))}
                      </>
                    );
                  }
                  // Các thẻ HTML khác (b, i, strong...) giữ nguyên
                }
              };

              return (
                <div key={currentIndex} className="exam-question inline-text mb-3" style={{ lineHeight: '2.2' }}>
                  {/* Số thứ tự câu hỏi */}
                  <strong style={{ marginRight: '8px', color: '#666' }}>({q.q_number})</strong>
                  
                  {/* Nội dung câu hỏi đã parse */}
                  <span>{parse(q.text || '', parseOptions)}</span>
                </div>
              );
            } 
            
            // --- LOGIC CÁC LOẠI CÂU HỎI KHÁC (Trắc nghiệm, Nối...) ---
            else {
              return (
                <div key={currentIndex} className="exam-question mb-4">
                  <label className="exam-question-label" style={{ display: 'block', marginBottom: '8px' }}>
                    <strong style={{ marginRight: '5px' }}>Q{q.q_number}.</strong> 
                    {/* Parse text để xử lý xuống dòng hoặc HTML trong câu hỏi thường */}
                    <span dangerouslySetInnerHTML={{ __html: (q.text || '').replace(/\n/g, '<br />') }} />
                  </label>
                  <QuestionInput
                    slot={slot}
                    value={answers[currentIndex]}
                    onChange={(v) => setAnswer(currentIndex, v)}
                    index={currentIndex}
                  />
                </div>
              );
            }
          })}
        </div>
      ))}
    </div>
  );

  const contentBlock = (
    <div className="exam-step-content">
      <div
        className="exam-content-inner"
        // Thêm replace \n -> <br> cho bài đọc luôn để chắc chắn
        dangerouslySetInnerHTML={{ __html: (item.content || '').replace(/\n/g, '<br />') }}
      />
    </div>
  );

  // Layout chia đôi màn hình
  return (
    <div className="exam-step-layout exam-step-layout--two-col">
      <div className="exam-step-passage">{contentBlock}</div>
      <div className="exam-step-questions-col">{questionsBlock}</div>
    </div>
  );
}

export default function Exam() {
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!id) return;
    api
      .getExam(id)
      .then((res) => {
        setExam(res.data);
        const slots = buildQuestionSlots(res.data);
        setAnswers(Array(slots.length).fill(''));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const slots = exam ? buildQuestionSlots(exam) : [];
  const steps = exam ? buildSteps(exam) : [];
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const setAnswer = (index, value) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    api
      .submitExam(id, { answers })
      .then((res) => setSubmitted(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setSubmitLoading(false));
  };

  if (loading) return <div className="page"><p className="muted">Loading exam…</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p><Link to="/tests">Back to tests</Link></div>;
  if (!exam) return <div className="page"><p className="muted">Exam not found.</p></div>;

  if (submitted) {
    const { score, total, wrong } = submitted;
    const wrongCount = wrong ?? (total - score);
    const pct = total ? Math.round((score / total) * 100) : 0;
    const correctPct = total ? (score / total) * 100 : 0;
    return (
      <div className="page exam-result">
        <h1 className="result-test-name">{exam.title}</h1>
        <div className="result-card">
          <div className="result-stats">
            <p className="result-stat"><strong>{total}</strong> questions</p>
            <p className="result-stat result-stat--correct"><strong>{score}</strong> correct</p>
            <p className="result-stat result-stat--wrong"><strong>{wrongCount}</strong> wrong</p>
          </div>
          <div className="result-donut-wrap">
            <div
              className="result-donut"
              style={{
                background: `conic-gradient(#22c55e 0% ${correctPct}%, #ef4444 ${correctPct}% 100%)`,
              }}
              aria-hidden
            />
            <div className="result-donut-center">
              <span className="result-donut-value">{score}/{total}</span>
              <span className="result-donut-pct">{pct}%</span>
            </div>
          </div>
          <p className="result-score">{score} / {total} ({pct}%)</p>
        </div>
        <Link to="/tests" className="btn btn-primary">Back to tests</Link>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="page">
        <p className="muted">This test has no passages or sections.</p>
        <Link to="/tests">Back to tests</Link>
      </div>
    );
  }

  return (
    <div className="page exam-page exam-page--stepper">
      <header className="exam-header">
        <div className="exam-header-left">
          <h1 className="exam-title">{exam.title}</h1>
          <span className="exam-step-badge">
            {step.type === 'reading' ? 'Reading' : 'Listening'} — {step.label} of {steps.filter((s) => s.type === step.type).length}
          </span>
        </div>
        <div className="exam-header-right">
          <Link to={`/tests/${id}`} className="btn btn-ghost btn-sm">Leave exam</Link>
        </div>
      </header>

      <div className="exam-stepper-nav">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            className={`exam-stepper-dot ${i === currentStep ? 'active' : ''}`}
            onClick={() => setCurrentStep(i)}
            title={`${s.label}`}
            aria-label={`Go to ${s.label}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="exam-step-heading">
        <h2>{step.label}</h2>
        {step.item.title && <span className="exam-step-meta">— {step.item.title}</span>}
        <span className="exam-step-meta">{step.type === 'reading' ? 'Reading' : 'Listening'}</span>
      </div>

      <form onSubmit={handleSubmit} className="exam-form">
        <StepContent step={step} slots={slots} answers={answers} setAnswer={setAnswer} />

        <nav className="exam-step-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCurrentStep((c) => Math.max(0, c - 1))}
            disabled={isFirst}
          >
            ← Previous
          </button>
          {isLast ? (
            <button type="submit" className="btn btn-primary" disabled={submitLoading}>
              {submitLoading ? 'Submitting…' : 'Submit answers'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCurrentStep((c) => Math.min(steps.length - 1, c + 1))}
            >
              Next →
            </button>
          )}
        </nav>
      </form>
    </div>
  );
}
