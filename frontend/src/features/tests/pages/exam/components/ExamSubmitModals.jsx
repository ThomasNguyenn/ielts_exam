export default function ExamSubmitModals({
  showSubmitConfirm,
  showScoreChoice,
  submitLoading,
  onCloseSubmitConfirm,
  onConfirmSubmit,
  onCloseScoreChoice,
  onChooseScoreMode,
}) {
  return (
    <>
      {showSubmitConfirm && (
        <div className="note-modal-overlay" onClick={onCloseSubmitConfirm}>
          <div className="note-modal" onClick={(event) => event.stopPropagation()}>
            <div className="note-modal-header">
              <h3>Finish Test?</h3>
              <button type="button" onClick={onCloseSubmitConfirm}>X</button>
            </div>
            <div style={{ padding: '10px 0', color: '#475569' }}>
              Are you sure you want to finish the test? You won&apos;t be able to change your answers after submitting.
            </div>
            <div className="note-modal-actions">
              <button type="button" className="btn-save" onClick={onConfirmSubmit} disabled={submitLoading}>
                {submitLoading ? 'Submitting...' : 'Yes, Finish'}
              </button>
              <button type="button" className="btn-cancel" onClick={onCloseSubmitConfirm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showScoreChoice && (
        <div className="note-modal-overlay" onClick={onCloseScoreChoice}>
          <div className="note-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="note-modal-header">
              <h3>Choose Scoring Method</h3>
              <button type="button" onClick={onCloseScoreChoice}>X</button>
            </div>
            <div style={{ padding: '15px 0', color: '#475569', textAlign: 'center' }}>
              <p>How would you like to grade your writing?</p>
            </div>
            <div className="note-modal-actions" style={{ flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => onChooseScoreMode('ai')}
                disabled={submitLoading}
                style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
              >
                {submitLoading ? 'Submitting...' : 'AI Detailed Scoring (Instant)'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onChooseScoreMode('standard')}
                disabled={submitLoading}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Standard Submit (Teacher Grading)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
