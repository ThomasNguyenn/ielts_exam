import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ExamStepNavigator({
  isSingleMode,
  hasSteps,
  steps,
  currentStep,
  setCurrentStep,
  isFirst,
  isLast,
}) {
  if (isSingleMode) return null;

  return (
    <>
      {hasSteps && (
        <div className="footer-step-nav">
          {steps.map((step, index) => {
            const stepKey = `${step.type}-${step.startSlotIndex}-${step.endSlotIndex}-${step.label}`;
            return (
              <button
                key={stepKey || `step-${index}`}
                type="button"
                className={`footer-step-btn ${index === currentStep ? 'active' : ''}`}
                onClick={() => setCurrentStep(index)}
              >
                {step.label.replace('Passage ', 'Part ')}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="footer-nav-arrow"
        onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
        disabled={isFirst}
        title="Previous Part"
      >
        <ChevronLeft size={15} />
      </button>
      <button
        type="button"
        className="footer-nav-arrow"
        onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
        disabled={isLast}
        title="Next Part"
      >
        <ChevronRight size={15} />
      </button>
    </>
  );
}
