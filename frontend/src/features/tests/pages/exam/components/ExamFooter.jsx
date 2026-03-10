import ExamQuestionPalette from './ExamQuestionPalette';
import ExamStepNavigator from './ExamStepNavigator';

export default function ExamFooter({
  useMobileReadingDrawer,
  footerNavigationItems,
  onPaletteSelect,
  isSingleMode,
  hasSteps,
  steps,
  currentStep,
  setCurrentStep,
  isFirst,
  isLast,
}) {
  return (
    <footer className={`exam-footer ${useMobileReadingDrawer ? 'exam-footer--mobile-reading' : ''}`}>
      {!useMobileReadingDrawer ? (
        <div className="exam-footer-center">
          <ExamQuestionPalette
            items={footerNavigationItems}
            onSelect={onPaletteSelect}
          />
        </div>
      ) : null}

      <div className="exam-footer-right">
        <ExamStepNavigator
          isSingleMode={isSingleMode}
          hasSteps={hasSteps}
          steps={steps}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          isFirst={isFirst}
          isLast={isLast}
        />
      </div>
    </footer>
  );
}
