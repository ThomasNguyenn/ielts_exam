function WritingStepContent({ step, writingAnswers, setWritingAnswer }) {
  const { item } = step;
  const taskIndex = parseInt(step.label.replace('Task ', '')) - 1;
  const currentAnswer = writingAnswers[taskIndex] || '';

  const wordCount = currentAnswer.trim() ? currentAnswer.trim().split(/\s+/).length : 0;
  const charCount = currentAnswer.length;

  const hasImage = !!item.image_url;

  return (
    <div className={`writing-step-content ${hasImage ? 'writing-step-content--with-image' : ''}`}>
      <div className="writing-prompt">
        <h3 className="writing-prompt-title">{item.title}</h3>
        <div className="writing-prompt-text" style={{ whiteSpace: 'pre-wrap' }}>
          {item.prompt || ''}
        </div>
        {hasImage && (
          <div className="writing-image-container">
            <img
              src={item.image_url}
              alt="Writing task visual"
              className="writing-task-image"
            />
          </div>
        )}
      </div>

      <div className="writing-input-area">
        <label className="writing-input-label">
          Your Answer:
        </label>
        <textarea
          className="writing-textarea"
          value={currentAnswer}
          onChange={(e) => setWritingAnswer(taskIndex, e.target.value)}
          placeholder="Write your answer here..."
          rows={15}
        />
        <div className="writing-stats">
          <span className="word-count">
            <strong>{wordCount}</strong> words
          </span>
          <span className="char-count">
            <strong>{charCount}</strong> characters
          </span>
        </div>
      </div>
    </div>
  );
}


export default WritingStepContent;
