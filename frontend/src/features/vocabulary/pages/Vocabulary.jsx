import { useState, useEffect } from 'react';
import { api } from '@/shared/api/client';
import { Link } from 'react-router-dom';
import { useNotification } from '@/shared/context/NotificationContext';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import VocabCardSkeleton from '@/shared/components/VocabCardSkeleton';
import {
    Book, Clock, Trash2, Search, Plus,
    ArrowLeft, RotateCcw, Check, Sparkles,
    AlertCircle, GraduationCap, Brain, Zap
} from 'lucide-react';
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
            setIsDeleteModalOpen(false);
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
            <div className="vocab-page">
                <div style={{
                    background: 'linear-gradient(135deg, #4F46E5, #818CF8)',
                    borderRadius: '20px',
                    padding: '2rem 2.5rem',
                    marginBottom: '2rem',
                    height: '160px'
                }} />

                <div className="voc-stats">
                    <div className="voc-stat-card" style={{ height: '100px', background: '#f1f5f9' }} />
                    <div className="voc-stat-card" style={{ height: '100px', background: '#f1f5f9' }} />
                    <div style={{ width: '200px', height: '100px', background: '#f1f5f9', borderRadius: '16px' }} />
                </div>

                <div className="voc-add-form" style={{ height: '200px', background: '#f1f5f9' }} />

                <div className="voc-word-list">
                    {[1, 2, 3, 4].map(i => (
                        <VocabCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    // ─── FLASHCARD MODE ───
    if (mode === 'flashcard') {
        const currentWord = vocabulary[currentCardIndex];
        if (!currentWord) {
            return (
                <div className="voc-flashcard-page">
                    <div className="voc-flashcard-container" style={{ textAlign: 'center' }}>
                        <h3>Không có từ nào để ôn tập</h3>
                        <button onClick={() => setMode('list')} className="voc-fc-back">
                            <ArrowLeft /> Quay lại danh sách
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="voc-flashcard-page">
                <div className="voc-flashcard-container">
                    <div className="voc-fc-header">
                        <button onClick={() => setMode('list')} className="voc-fc-back">
                            <ArrowLeft /> Thoát
                        </button>
                        <span className="voc-fc-progress">
                            {currentCardIndex + 1} / {vocabulary.length}
                        </span>
                    </div>

                    <div
                        className={`voc-fc-card ${showAnswer ? 'flipped' : ''}`}
                        onClick={() => setShowAnswer(!showAnswer)}
                    >
                        <div className="voc-fc-front">
                            <h2 className="voc-fc-word">{currentWord.word}</h2>
                            <div className="voc-fc-hint">
                                <RotateCcw /> Click để lật thẻ
                            </div>
                        </div>

                        <div className="voc-fc-back-content">
                            <h3 className="voc-fc-word">{currentWord.word}</h3>
                            <p className="voc-fc-context">"{currentWord.context}"</p>
                            {currentWord.definition && (
                                <p className="voc-fc-definition">
                                    <strong>Định nghĩa:</strong> {currentWord.definition}
                                </p>
                            )}
                            {currentWord.notes && (
                                <p className="voc-fc-notes">
                                    <strong>Ghi chú:</strong> {currentWord.notes}
                                </p>
                            )}
                        </div>
                    </div>

                    {showAnswer && (
                        <div className="voc-fc-actions">
                            <button onClick={() => handleReview('hard')} className="voc-fc-diff-btn voc-fc-diff-btn--hard">
                                Khó
                            </button>
                            <button onClick={() => handleReview('medium')} className="voc-fc-diff-btn voc-fc-diff-btn--medium">
                                Trung bình
                            </button>
                            <button onClick={() => handleReview('easy')} className="voc-fc-diff-btn voc-fc-diff-btn--easy">
                                Dễ
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── LIST MODE ───
    return (
        <div className="vocab-page">
            {/* Hero */}
            <div className="voc-hero">
                <div className="voc-hero-content">
                    <div className="voc-hero-text">
                        <h1>📚 My Vocabulary</h1>
                        <p>Quản lý và ôn tập từ vựng cá nhân theo chuẩn Spaced Repetition.</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="voc-stats">
                    <div className="voc-stat-card">
                        <div className="voc-stat-icon voc-stat-icon--total">
                            <Book />
                        </div>
                        <div className="voc-stat-info">
                            <div className="voc-stat-value">{stats.total}</div>
                            <div className="voc-stat-label">Tổng số từ</div>
                        </div>
                    </div>
                    <div className="voc-stat-card">
                        <div className="voc-stat-icon voc-stat-icon--due">
                            <Clock />
                        </div>
                        <div className="voc-stat-info">
                            <div className="voc-stat-value">{stats.due}</div>
                            <div className="voc-stat-label">Cần ôn tập</div>
                        </div>
                    </div>
                    <button
                        onClick={startFlashcards}
                        className="voc-review-btn"
                        disabled={vocabulary.length === 0}
                    >
                        <Zap style={{ marginRight: '0.5rem' }} />
                        Bắt đầu ôn tập
                    </button>
                </div>
            )}

            {/* Add Form */}
            <div className="voc-add-form">
                <div className="voc-add-form-header">
                    <Sparkles />
                    <h3>Thêm từ mới</h3>
                </div>
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
                            showNotification(errorMsg.includes('already') ? 'Từ này đã tồn tại!' : 'Lỗi khi thêm từ', 'error');
                        });
                }}>
                    <div className="voc-form-row">
                        <input
                            type="text"
                            name="word"
                            placeholder="Word (e.g., 'ubiquitous')"
                            className="voc-input"
                            required
                        />
                        <input
                            type="text"
                            name="definition"
                            placeholder="Definition (optional)"
                            className="voc-input"
                        />
                    </div>
                    <textarea
                        name="context"
                        placeholder="Context sentence (e.g., 'The smartphone has become ubiquitous in modern society.')"
                        className="voc-textarea"
                        rows="2"
                        required
                    />
                    <button type="submit" className="voc-add-btn">
                        <Plus /> Add Word
                    </button>
                </form>
            </div>

            {/* Filters */}
            <div className="voc-filters">
                <div className="voc-search-wrapper">
                    <Search className="voc-search-icon" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm từ vựng..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="voc-search"
                    />
                </div>
                <select
                    value={filterMastery}
                    onChange={(e) => setFilterMastery(e.target.value)}
                    className="voc-filter-select"
                >
                    <option value="">Tất cả cấp độ</option>
                    <option value="0">New</option>
                    <option value="1">Learning</option>
                    <option value="2">Familiar</option>
                    <option value="3">Known</option>
                    <option value="4">Mastered</option>
                    <option value="5">Perfect</option>
                </select>
                <label className={`voc-due-toggle ${dueOnly ? 'voc-due-toggle--active' : ''}`}>
                    <input
                        type="checkbox"
                        checked={dueOnly}
                        onChange={(e) => setDueOnly(e.target.checked)}
                    />
                    {dueOnly ? <Check /> : <Clock />}
                    Chỉ từ cần ôn tập
                </label>
            </div>

            {/* List */}
            {vocabulary.length === 0 ? (
                <div className="voc-empty">
                    <div className="voc-empty-icon">
                        <Book />
                    </div>
                    <h3>Không có từ vựng nào</h3>
                    <p>Hãy thêm từ vựng mới để bắt đầu học!</p>
                </div>
            ) : (
                <div className="voc-word-list">
                    {vocabulary.map((word) => (
                        <div key={word._id} className="voc-word-card">
                            <div className="voc-word-card-header">
                                <h3 className="voc-word-name">{word.word}</h3>
                                <span
                                    className="voc-mastery-badge"
                                    style={{ backgroundColor: getMasteryColor(word.mastery_level) }}
                                >
                                    {getMasteryLabel(word.mastery_level)}
                                </span>
                            </div>
                            <p className="voc-word-context">"{word.context}"</p>
                            {word.definition && (
                                <p className="voc-word-definition"><strong>Định nghĩa:</strong> {word.definition}</p>
                            )}
                            {word.notes && (
                                <p className="voc-word-notes"><strong>Ghi chú:</strong> {word.notes}</p>
                            )}
                            <div className="voc-word-meta">
                                <span>
                                    <Clock size={12} />
                                    Thêm vào: {new Date(word.added_at).toLocaleDateString()}
                                </span>
                                {word.review_count > 0 && (
                                    <span>
                                        <Brain size={12} />
                                        Đã ôn {word.review_count} lần
                                    </span>
                                )}
                                <button
                                    onClick={() => handleDelete(word)}
                                    className="voc-delete-btn"
                                >
                                    <Trash2 /> Xóa
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
    );
}
