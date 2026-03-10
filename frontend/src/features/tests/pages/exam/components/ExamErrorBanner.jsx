export default function ExamErrorBanner({ submitError, submitLoading, onRetry }) {
  if (!submitError) return null;

  return (
    <div className="exam-submit-error">
      <strong>Submit failed:</strong> {submitError}
      <button
        type="button"
        className="exam-submit-error__retry"
        onClick={onRetry}
        disabled={submitLoading}
      >
        {submitLoading ? 'Retrying...' : 'Retry submit'}
      </button>
    </div>
  );
}
