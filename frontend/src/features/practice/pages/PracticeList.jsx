import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import PracticeCardSkeleton from '@/shared/components/PracticeCardSkeleton';
import { PenTool, Search, ArrowRight, FileText, Sparkles, ChevronDown, Check } from 'lucide-react';
import { getWritingTaskTypeLabel, getWritingTaskTypeOptions } from '@/shared/constants/writingTaskTypes';
import './PracticeList.css';

export default function PracticeList() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, task1, task2
    const [selectedVariant, setSelectedVariant] = useState('all');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setSelectedVariant('all');
    }, [filterType]);

    let variantOptions = [{ value: 'all', label: 'Tất cả dạng bài' }];
    
    const scopedTasks = tasks.filter(t => 
       filterType === 'all' || t.task_type === filterType
    );
    const availableVariants = new Set(scopedTasks.map(t => t.writing_task_type).filter(Boolean));
    
    let baseOptions = [];
    if (filterType === 'task1') {
        baseOptions = getWritingTaskTypeOptions('task1');
    } else if (filterType === 'task2') {
        baseOptions = getWritingTaskTypeOptions('task2');
    } else {
        baseOptions = [
            ...getWritingTaskTypeOptions('task1'),
            ...getWritingTaskTypeOptions('task2')
        ];
        baseOptions = Array.from(new Map(baseOptions.map(o => [o.value, o])).values());
    }

    const availableOrderedOptions = baseOptions.filter(opt => availableVariants.has(opt.value));
    
    const additionalOptions = Array.from(availableVariants)
        .filter(val => !baseOptions.some(opt => opt.value === val))
        .map(val => ({ value: val, label: getWritingTaskTypeLabel(val) || val }));

    if (availableOrderedOptions.length > 0 || additionalOptions.length > 0) {
        variantOptions = [
            ...variantOptions,
            ...availableOrderedOptions,
            ...additionalOptions
        ];
    }

    useEffect(() => {
        setLoading(true);
        api.getWritings()
            .then((res) => {
                if (res.success) setTasks(res.data || []);
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const filteredTasks = tasks.filter(t => {
        const title = t.title || '';
        const prompt = t.prompt || '';
        const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            prompt.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = filterType === 'all' ||
            (filterType === 'task1' && t.task_type === 'task1') ||
            (filterType === 'task2' && t.task_type === 'task2');

        const matchesVariant = selectedVariant === 'all' || t.writing_task_type === selectedVariant;

        return matchesSearch && matchesType && matchesVariant;
    });

    const task1Count = tasks.filter(t => t.task_type === 'task1').length;
    const task2Count = tasks.filter(t => t.task_type === 'task2').length;

    /* Skeleton loading */
    if (loading) {
        return (
            <div className="writing-page">
                <div style={{
                    background: 'linear-gradient(135deg, #4F46E5, #818CF8)',
                    borderRadius: '20px',
                    padding: '2.5rem 3rem',
                    marginBottom: '2rem'
                }}>
                    <div style={{ height: '2rem', width: '40%', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', marginBottom: '0.75rem' }} />
                    <div style={{ height: '1rem', width: '55%', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }} />
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                    <div style={{ flex: 1, minWidth: '200px', height: '44px', background: '#F1F5F9', borderRadius: '12px' }} />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{ width: '80px', height: '36px', background: '#F1F5F9', borderRadius: '50px' }} />
                        ))}
                    </div>
                </div>

                <div className="wr-cards-grid">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <PracticeCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="writing-page">
            {/* ── Hero Banner ── */}
            <div className="wr-hero">
                <div className="wr-hero-content">
                    <div className="wr-hero-text">
                        <h1>✍️ Luyện viết Writing</h1>
                        <p>Chọn đề bài và luyện viết với AI chấm điểm chi tiết theo 4 tiêu chí IELTS.</p>
                    </div>
                    <div className="wr-hero-actions">
                        <Link to="/learn/skills" className="wr-hero-btn wr-hero-btn--primary">
                            <Sparkles size={16} />
                            Skill Workshop
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── Controls ── */}
            <div className="wr-controls">
                <div className="wr-search-wrapper">
                    <Search className="wr-search-icon" />
                    <input
                        type="search"
                        placeholder="Tìm kiếm đề bài..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="wr-search"
                    />
                </div>

                <div className="wr-task-filters">
                    {[
                        { key: 'all', label: 'Tất cả', count: tasks.length },
                        { key: 'task1', label: 'Task 1', count: task1Count },
                        { key: 'task2', label: 'Task 2', count: task2Count }
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilterType(f.key)}
                            className={`wr-pill ${filterType === f.key ? 'wr-pill--active' : ''}`}
                        >
                            {f.label} ({f.count})
                        </button>
                    ))}

                    {variantOptions.length > 1 && (
                        <div className="wr-variant-dropdown" ref={dropdownRef}>
                            <button
                                className={`wr-variant-btn ${selectedVariant !== 'all' ? 'wr-variant-btn--active' : ''}`}
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <span className="wr-variant-btn-text">
                                    {variantOptions.find(opt => opt.value === selectedVariant)?.label || 'Dạng bài'}
                                </span>
                                <ChevronDown className={`wr-variant-btn-icon ${isDropdownOpen ? 'open' : ''}`} />
                            </button>
                            
                            {isDropdownOpen && (
                                <div className="wr-variant-menu">
                                    {variantOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`wr-variant-option ${selectedVariant === opt.value ? 'selected' : ''}`}
                                            onClick={() => {
                                                setSelectedVariant(opt.value);
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            {opt.label}
                                            {selectedVariant === opt.value && <Check className="wr-variant-check" size={16} />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Cards Grid ── */}
            {filteredTasks.length === 0 ? (
                <div className="wr-empty">
                    <div className="wr-empty-icon">
                        <FileText />
                    </div>
                    <h3>Không tìm thấy đề bài nào</h3>
                    <p>Thử tìm kiếm với từ khoá khác hoặc bỏ bộ lọc.</p>
                </div>
            ) : (
                <div className="wr-cards-grid">
                    {filteredTasks.map(t => (
                        <div key={t._id} className="wr-card">
                            <div className="wr-card-top">
                                <span className={`wr-card-badge ${t.task_type === 'task1' ? 'wr-card-badge--t1' : 'wr-card-badge--t2'}`}>
                                    {t.task_type === 'task1' ? 'Task 1' : 'Task 2'}
                                </span>
                                <div className="wr-card-icon">
                                    <PenTool />
                                </div>
                            </div>

                            <h3 className="wr-card-title">{t.title}</h3>
                            <p className="wr-card-prompt">{t.prompt}</p>

                            <Link to={`/practice/${t._id}`} className="wr-card-link">
                                Bắt đầu luyện tập
                                <ArrowRight />
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
