import React, { useState } from 'react';
import { api } from '../../../api/client';
import './CheckpointQuiz.css';

const CheckpointQuiz = ({ module, onComplete, onBack }) => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const quiz = module.content.checkpointQuiz;

    const handleSelectAnswer = (answerIndex) => {
        const newAnswers = [...answers];
        newAnswers[currentQuestion] = answerIndex;
        setAnswers(newAnswers);
    };

    const handleNext = () => {
        if (currentQuestion < quiz.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
        }
    };

    const handleSubmit = async () => {
        // Check if all questions answered
        if (answers.length < quiz.length || answers.some(a => a === undefined)) {
            alert('Please answer all questions before submitting');
            return;
        }

        setLoading(true);
        try {
            const response = await api.submitSkillQuiz(module._id, answers);
            setResult(response);
        } catch (error) {
            console.error('Error submitting quiz:', error);
            alert('Failed to submit quiz. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = () => {
        onComplete(result.score, result.passed);
    };

    if (result) {
        return (
            <div className="checkpoint-quiz">
                <div className="quiz-result">
                    <div className={`result-icon ${result.passed ? 'passed' : 'failed'}`}>
                        {result.passed ? '🎉' : '📚'}
                    </div>
                    <h2 className="result-title">
                        {result.passed ? 'Congratulations!' : 'Keep Learning'}
                    </h2>
                    <div className="result-score">
                        <div className="score-circle">
                            <span className="score-number">{result.score}%</span>
                        </div>
                        <p className="score-text">
                            {result.correctCount} out of {result.totalQuestions} correct
                        </p>
                    </div>

                    {result.passed ? (
                        <p className="result-message">
                            Great job! You've mastered this module and unlocked the next one.
                        </p>
                    ) : (
                        <p className="result-message">
                            You need 70% to pass. Review the lesson and try again!
                        </p>
                    )}

                    <div className="quiz-details">
                        <h3>Your Answers</h3>
                        {result.results.map((r, index) => (
                            <div key={index} className={`answer-detail ${r.isCorrect ? 'correct' : 'incorrect'}`}>
                                <div className="answer-header">
                                    <span className="question-num">Question {index + 1}</span>
                                    <span className={`answer-icon ${r.isCorrect ? 'correct' : 'incorrect'}`}>
                                        {r.isCorrect ? '✓' : '✗'}
                                    </span>
                                </div>
                                <p className="question-text">{quiz[index].question}</p>
                                {!r.isCorrect && (
                                    <div className="correct-answer-info">
                                        <p><strong>Correct answer:</strong> {quiz[index].options[r.correctAnswer]}</p>
                                        {r.explanation && <p className="explanation">{r.explanation}</p>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="result-actions">
                        {result.passed ? (
                            <button onClick={handleFinish} className="btn-finish">
                                Continue →
                            </button>
                        ) : (
                            <>
                                <button onClick={onBack} className="btn-retry-secondary">
                                    Review Lesson
                                </button>
                                <button onClick={() => { setResult(null); setAnswers([]); setCurrentQuestion(0); }} className="btn-retry">
                                    Retry Quiz
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const question = quiz[currentQuestion];
    const progress = ((currentQuestion + 1) / quiz.length) * 100;
    const isLastQuestion = currentQuestion === quiz.length - 1;

    return (
        <div className="checkpoint-quiz">
            <div className="quiz-header">
                <button onClick={onBack} className="back-button">
                    ← Back to Lesson
                </button>
                <div className="quiz-progress">
                    <span className="progress-text">Question {currentQuestion + 1} of {quiz.length}</span>
                    <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="quiz-content">
                <h2 className="quiz-question">{question.question}</h2>

                <div className="quiz-options">
                    {question.options.map((option, index) => (
                        <button
                            key={index}
                            className={`quiz-option ${answers[currentQuestion] === index ? 'selected' : ''}`}
                            onClick={() => handleSelectAnswer(index)}
                        >
                            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                            <span className="option-text">{option}</span>
                            {answers[currentQuestion] === index && (
                                <span className="option-check">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="quiz-navigation">
                <button
                    onClick={handlePrevious}
                    className="btn-nav"
                    disabled={currentQuestion === 0}
                >
                    ← Previous
                </button>

                <div className="answer-indicators">
                    {quiz.map((_, index) => (
                        <div
                            key={index}
                            className={`answer-dot ${answers[index] !== undefined ? 'answered' : ''} ${index === currentQuestion ? 'current' : ''}`}
                            onClick={() => setCurrentQuestion(index)}
                        ></div>
                    ))}
                </div>

                {!isLastQuestion ? (
                    <button
                        onClick={handleNext}
                        className="btn-nav"
                    >
                        Next →
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        className="btn-submit"
                        disabled={loading}
                    >
                        {loading ? 'Submitting...' : 'Submit Quiz'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default CheckpointQuiz;
