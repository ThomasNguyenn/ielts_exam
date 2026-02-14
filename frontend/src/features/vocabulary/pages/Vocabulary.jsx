import { useState, useEffect } from 'react';
import { api } from '@/shared/api/client';
import { Link } from 'react-router-dom';
import { useNotification } from '@/shared/context/NotificationContext';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import VocabCardSkeleton from '@/shared/components/VocabCardSkeleton';
import './Vocabulary.css';

export default function Vocabulary() {
    const { showNotification } = useNotification();
    const [vocabulary, setVocabulary] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('list'); // 'list' or 'flashcard'
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMastery, setFilterMastery] = useState('');
    const [dueOnly, setDueOnly] = useState(false);
    const [wordToDelete, setWordToDelete] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        loadVocabulary();
        loadStats();
    }, [searchTerm, filterMastery, dueOnly]);

    const loadVocabulary = async () => {
        try {
            setLoading(true);
            const params = {};
            if (searchTerm) params.search = searchTerm;
            if (filterMastery !== '') params.mastery = filterMastery;
            if (dueOnly) params.dueOnly = 'true';

            const res = await api.getVocabulary(params);
            setVocabulary(res.data);
        } catch (error) {
            console.error('Error loading vocabulary:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const res = await api.getVocabularyStats();
            setStats(res.data);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const handleDelete = (word) => {
        setWordToDelete(word);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!wordToDelete) return;

        try {
            await api.deleteVocabulary(wordToDelete._id);
            showNotification('Word deleted', 'success');
            loadVocabulary();
            loadStats();
        } catch (error) {
            console.error('Error deleting vocabulary:', error);
            showNotification('Failed to delete word', 'error');
        } finally {
            setWordToDelete(null);
        }
    };

    const handleReview = async (difficulty) => {
        const currentWord = vocabulary[currentCardIndex];
        if (!currentWord) return;

        try {
            const res = await api.reviewVocabulary(currentWord._id, difficulty);

            // Handle XP Gain
            if (res.xpResult) {
                const { xpGained, currentLevel, levelUp } = res.xpResult;
                showNotification(`Received ${xpGained} XP!`, 'success');
                if (levelUp) {
                    showNotification(`Level Up! You are now Level ${currentLevel}`, 'success');
                }

                // Update local user state
                const currentUser = api.getUser();
                if (currentUser) {
                    api.setUser({
                        ...currentUser,
                        xp: res.xpResult.currentXP,
                        level: currentLevel
                    });
                }
            }

            // Move to next card
            if (currentCardIndex < vocabulary.length - 1) {
                setCurrentCardIndex(currentCardIndex + 1);
                setShowAnswer(false);
            } else {
                // Finished all cards
                showNotification('Tuyệt vời! Bạn đã ôn tập xong tất cả các từ.', 'success');
                setMode('list');
                setCurrentCardIndex(0);
                setShowAnswer(false);
                loadVocabulary();
                loadStats();
            }
        } catch (error) {
            console.error('Lỗi khi ôn tập từ vựng:', error);
            showNotification('Lỗi khi lưu đánh giá', 'error');
        }
    };

    const startFlashcards = () => {
        if (vocabulary.length === 0) {
            showNotification('Không có từ nào để ôn tập!', 'warning');
            return;
        }
        setMode('flashcard');
        setCurrentCardIndex(0);
        setShowAnswer(false);
    };

    const getMasteryLabel = (level) => {
        const labels = ['New', 'Learning', 'Familiar', 'Known', 'Mastered', 'Perfect'];
        return labels[level] || 'Unknown';
    };

    const getMasteryColor = (level) => {
        const colors = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981'];
        return colors[level] || '#9ca3af';
    };

    if (loading && vocabulary.length === 0) {
        return (
            <div className="page">
                <div className="container">
                    <div className="vocab-header mb-8">
                        <div className="h-10 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                    </div>

                    {/* Stats Skeleton */}
                    <div className="vocab-stats mb-8 flex gap-4">
                        <div className="h-24 bg-gray-200 rounded-xl flex-1 animate-pulse"></div>
                        <div className="h-24 bg-gray-200 rounded-xl flex-1 animate-pulse"></div>
                        <div className="h-24 bg-gray-200 rounded-xl flex-1 animate-pulse"></div>
                    </div>

                    {/* Form Skeleton */}
                    <div className="vocab-add-form mb-8 p-6 border border-gray-200 rounded-xl bg-white">
                        <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="h-10 bg-gray-200 rounded flex-1 animate-pulse"></div>
                                <div className="h-10 bg-gray-200 rounded flex-1 animate-pulse"></div>
                            </div>
                            <div className="h-20 bg-gray-200 rounded w-full animate-pulse"></div>
                            <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
                        </div>
                    </div>

                    <div className="vocab-list">
                        {[1, 2, 3, 4].map(i => (
                            <VocabCardSkeleton key={i} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Flashcard Mode
    if (mode === 'flashcard') {
        const currentWord = vocabulary[currentCardIndex];
        if (!currentWord) {
            return (
                <div className="page">
                    <div className="container">
                        <p>Không có từ nào để ôn tập.</p>
                        <button onClick={() => setMode('list')} className="btn btn-secondary">
                            Quay lại danh sách
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="page vocab-flashcard-page">
                <div className="vocab-flashcard-container">
                    <div className="flashcard-header">
                        <button onClick={() => setMode('list')} className="btn btn-ghost">
                            ← Quay lại danh sách
                        </button>
                        <span className="flashcard-progress">
                            {currentCardIndex + 1} / {vocabulary.length}
                        </span>
                    </div>

                    <div className={`flashcard ${showAnswer ? 'flipped' : ''}`} onClick={() => setShowAnswer(!showAnswer)}>
                        <div className="flashcard-front">
                            <h2 className="flashcard-word">{currentWord.word}</h2>
                            <p className="flashcard-hint">Click để xem ngữ cảnh</p>
                        </div>
                        <div className="flashcard-back">
                            <h3 className="flashcard-word">{currentWord.word}</h3>
                            <p className="flashcard-context">"{currentWord.context}"</p>
                            {currentWord.definition && (
                                <p className="flashcard-definition"><strong>Định nghĩa:</strong> {currentWord.definition}</p>
                            )}
                            {currentWord.notes && (
                                <p className="flashcard-notes"><strong>Ghi chú:</strong> {currentWord.notes}</p>
                            )}
                        </div>
                    </div>

                    {showAnswer && (
                        <div className="flashcard-actions">
                            <button onClick={() => handleReview('hard')} className="btn btn-difficulty btn-hard">
                                Khó
                            </button>
                            <button onClick={() => handleReview('medium')} className="btn btn-difficulty btn-medium">
                                Trung bình
                            </button>
                            <button onClick={() => handleReview('easy')} className="btn btn-difficulty btn-easy">
                                Dễ
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // List Mode
    return (
        <div className="page">
            <div className="container">
                <div className="vocab-header">
                    <h1>My Vocabulary</h1>
                    <Link to="/tests" className="btn btn-ghost">Quay lại Tests</Link>
                </div>

                {stats && (
                    <div className="vocab-stats">
                        <div className="vocab-stat-card">
                            <div className="vocab-stat-value">{stats.total}</div>
                            <div className="vocab-stat-label">Tổng số từ</div>
                        </div>
                        <div className="vocab-stat-card vocab-stat-card--due">
                            <div className="vocab-stat-value">{stats.due}</div>
                            <div className="vocab-stat-label">Đang cần ôn tập</div>
                        </div>
                        <button onClick={startFlashcards} className="btn-vocab-primary" disabled={vocabulary.length === 0}>
                            📚 Bắt đầu ôn tập
                        </button>
                    </div>
                )}

                {/* Manual Add Word Form */}
                <div className="vocab-add-form">
                    <h3>Add New Word</h3>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        const word = formData.get('word').trim();
                        const context = formData.get('context').trim();
                        const definition = formData.get('definition').trim();

                        if (!word || !context) {
                            showNotification('Từ và ngữ cảnh là bắt buộc!', 'warning');
                            return;
                        }

                        api.addVocabulary({ word, context, definition })
                            .then(() => {
                                e.target.reset();
                                loadVocabulary();
                                loadStats();
                                showNotification(`"${word}" added to vocabulary!`, 'success');
                            })
                            .catch(err => {
                                console.error('Error adding vocabulary:', err);
                                const errorMsg = err.message || 'Unknown error';

                                if (errorMsg.includes('already in your vocabulary')) {
                                    showNotification('This word is already in your vocabulary list!', 'warning');
                                } else if (errorMsg.includes('Unauthorized') || errorMsg.includes('401')) {
                                    showNotification('Please log in to add vocabulary words.', 'error');
                                } else if (errorMsg.includes('Network') || errorMsg.includes('Failed to fetch')) {
                                    showNotification('Cannot connect to server. Please make sure the backend is running.', 'error');
                                } else {
                                    showNotification(`Failed to add word: ${errorMsg}`, 'error');
                                }
                            });
                    }}>
                        <div className="vocab-form-row">
                            <input
                                type="text"
                                name="word"
                                placeholder="Word (e.g., 'ubiquitous')"
                                className="vocab-input"
                                required
                            />
                            <input
                                type="text"
                                name="definition"
                                placeholder="Definition (optional)"
                                className="vocab-input"
                            />
                        </div>
                        <textarea
                            name="context"
                            placeholder="Context sentence (e.g., 'The smartphone has become ubiquitous in modern society.')"
                            className="vocab-textarea"
                            rows="2"
                            required
                        />
                        <button type="submit" className="btn-vocab-primary">
                            ➕ Add Word
                        </button>
                    </form>
                </div>

                <div className="vocab-filters">
                    <input
                        type="text"
                        placeholder="Tìm kiếm từ vựng..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="vocab-search"
                    />
                    <select
                        value={filterMastery}
                        onChange={(e) => setFilterMastery(e.target.value)}
                        className="vocab-filter"
                    >
                        <option value="">Tất cả cấp độ</option>
                        <option value="0">New</option>
                        <option value="1">Learning</option>
                        <option value="2">Familiar</option>
                        <option value="3">Known</option>
                        <option value="4">Mastered</option>
                        <option value="5">Perfect</option>
                    </select>
                    <label className="vocab-checkbox">
                        <input
                            type="checkbox"
                            checked={dueOnly}
                            onChange={(e) => setDueOnly(e.target.checked)}
                        />
                        Chỉ từ vựng cần ôn tập
                    </label>
                </div>

                {vocabulary.length === 0 ? (
                    <div className="vocab-empty">
                        <p>Không có từ vựng nào.</p>
                        <p>Sử dụng form trên để thêm từ vựng thủ công!</p>
                    </div>
                ) : (
                    <div className="vocab-list">
                        {vocabulary.map((word) => (
                            <div key={word._id} className="vocab-card">
                                <div className="vocab-card-header">
                                    <h3 className="vocab-word">{word.word}</h3>
                                    <span
                                        className="vocab-mastery-badge"
                                        style={{ backgroundColor: getMasteryColor(word.mastery_level) }}
                                    >
                                        {getMasteryLabel(word.mastery_level)}
                                    </span>
                                </div>
                                <p className="vocab-context">"{word.context}"</p>
                                {word.definition && (
                                    <p className="vocab-definition"><strong>Định nghĩa:</strong> {word.definition}</p>
                                )}
                                {word.notes && (
                                    <p className="vocab-notes"><strong>Ghi chú:</strong> {word.notes}</p>
                                )}
                                <div className="vocab-meta">
                                    <span className="vocab-date">
                                        Thêm vào: {new Date(word.added_at).toLocaleDateString()}
                                    </span>
                                    {word.review_count > 0 && (
                                        <span className="vocab-reviews">
                                            Đã đánh giá {word.review_count} lần
                                        </span>
                                    )}
                                    <button
                                        onClick={() => handleDelete(word)}
                                        className="btn-delete-vocab"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <ConfirmationModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={confirmDelete}
                    title="Xóa từ vựng"
                    message={`Bạn có chắc chắn muốn xóa "${wordToDelete?.word}"? Hành động này không thể được hoàn tác.`}
                    confirmText="Xóa"
                    isDanger={true}
                />
            </div>
        </div>
    );
}
