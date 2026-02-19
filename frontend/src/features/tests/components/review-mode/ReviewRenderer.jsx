import QuestionReview from './QuestionReview';

export default function ReviewRenderer({ questions = [] }) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return (
      <section className="review-renderer">
        <div className="review-empty">{'Chưa có dữ liệu để xem lại.'}</div>
      </section>
    );
  }

  return (
    <section className="review-renderer">
      {questions.map((question, index) => (
        <QuestionReview
          key={`${question?.id || question?.question_number || index}-${index}`}
          question={question}
          index={index}
        />
      ))}
    </section>
  );
}
