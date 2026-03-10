import { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Clock3 } from 'lucide-react';

const getTimerClass = (warningLevel) => {
  if (warningLevel === '5min') return 'exam-timer exam-timer--flash-5';
  if (warningLevel === '10min') return 'exam-timer exam-timer--flash-10';
  return 'exam-timer';
};

export default function ExamHeader({
  step,
  exitTestPath,
  timeLabel,
  timeRemaining,
  warningLevel,
  listeningResumeNotice,
  SettingsComponent,
  brightness,
  setBrightness,
  textSize,
  setTextSize,
  theme,
  setTheme,
  onSubmit,
  submitLoading,
}) {
  return (
    <>
      {listeningResumeNotice && (
        <div className="listening-resume-toast" role="status" aria-live="polite">
          {listeningResumeNotice}
        </div>
      )}
      <header className="exam-header">
        <div className="exam-header-main">
          <div className="exam-header-left">
            <div className="exam-title-group">
              <div className="exam-part-main">
                <span className="exam-part-label">{step.label}</span>
                <span className="exam-part-title-text">{step.item.title || 'Read the text and answer questions'}</span>
              </div>
            </div>
          </div>

          <div className="exam-header-right">
            <Link to={exitTestPath} className="btn-exit-test">
              Exit Test
            </Link>
            <div className="exam-timer-wrapper" role="status" aria-live="polite">
              {timeRemaining !== null && (
                <div className={getTimerClass(warningLevel)}>
                  <Clock3 className="exam-timer-icon" size={15} />
                  <span className="exam-timer-text">{timeLabel} remaining</span>
                </div>
              )}
            </div>

            <Suspense fallback={null}>
              <SettingsComponent
                brightness={brightness}
                setBrightness={setBrightness}
                textSize={textSize}
                setTextSize={setTextSize}
                theme={theme}
                setTheme={setTheme}
              />
            </Suspense>

            <button
              type="button"
              className="btn-finish-test"
              onClick={onSubmit}
              disabled={submitLoading}
            >
              {submitLoading ? 'Submitting...' : 'Finish Test'}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
