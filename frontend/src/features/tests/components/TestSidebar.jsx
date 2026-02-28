import {
    Headphones,
    BookOpen,
    PenTool,
    LayoutGrid,
    Layers,
    Filter,
    TrendingUp,
} from 'lucide-react';
import './TestSidebar.css';

const SKILL_FILTERS = [
    { id: 'reading', label: 'Reading', icon: BookOpen },
    { id: 'writing', label: 'Writing', icon: PenTool },
    { id: 'listening', label: 'Listening', icon: Headphones },
];

function getPartOptions(selectedType) {
    if (selectedType === 'reading') {
        return [
            { value: 'all', label: 'All Passages' },
            { value: 'part1', label: 'Passage 1' },
            { value: 'part2', label: 'Passage 2' },
            { value: 'part3', label: 'Passage 3' },
        ];
    }
    if (selectedType === 'listening') {
        return [
            { value: 'all', label: 'All Sections' },
            { value: 'part1', label: 'Section 1' },
            { value: 'part2', label: 'Section 2' },
            { value: 'part3', label: 'Section 3' },
            { value: 'part4', label: 'Section 4' },
        ];
    }
    if (selectedType === 'writing') {
        return [
            { value: 'all', label: 'All Tasks' },
            { value: 'part1', label: 'Task 1' },
            { value: 'part2', label: 'Task 2' },
        ];
    }
    return [
        { value: 'all', label: 'All Parts' },
        { value: 'part1', label: 'Part 1' },
        { value: 'part2', label: 'Part 2' },
        { value: 'part3', label: 'Part 3' },
        { value: 'part4', label: 'Part 4' },
    ];
}

export default function TestSidebar({
    selectedType,
    onTypeChange,
    viewMode,
    onViewModeChange,
    selectedPartFilter,
    onPartFilterChange,
    selectedQuestionGroupFilter = 'all',
    onQuestionGroupFilterChange,
    questionGroupOptions = [],
    totalTests = 0,
    completedTests = 0,
}) {
    const safeTotal = Math.max(0, Number(totalTests) || 0);
    const safeCompleted = Math.min(Math.max(0, Number(completedTests) || 0), safeTotal);
    const progress = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0;
    const canShowQuestionGroupFilter = viewMode === 'parts' && (selectedType === 'reading' || selectedType === 'listening');
    const safeQuestionGroupOptions = questionGroupOptions.length
        ? questionGroupOptions
        : [{ value: 'all', label: 'All Question Groups' }];

    return (
        <aside className="ts">
            <div className="ts-sticky">
                {/* Filter Header */}
                <div className="ts-filter-header">
                    <Filter />
                    <span>Filters</span>
                </div>

                {/* Skills */}
                <div className="ts-card">
                    <h3>Skills</h3>
                    <div className="ts-btn-list">
                        {/* All skills option */}
                        <button
                            className={`ts-btn ${selectedType === 'all' ? 'active' : ''}`}
                            onClick={() => onTypeChange('all')}
                        >
                            <LayoutGrid />
                            <span>All Skills</span>
                            {selectedType === 'all' && <div className="ts-active-dot" />}
                        </button>

                        {SKILL_FILTERS.map((skill) => {
                            const isActive = selectedType === skill.id;
                            const Icon = skill.icon;
                            return (
                                <button
                                    key={skill.id}
                                    className={`ts-btn ${isActive ? 'active' : ''}`}
                                    data-skill={skill.id}
                                    onClick={() => onTypeChange(skill.id)}
                                >
                                    <Icon />
                                    <span>{skill.label}</span>
                                    {isActive && <div className="ts-active-dot" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Test Mode */}
                <div className="ts-card">
                    <h3>Test Mode</h3>
                    <div className="ts-btn-list">
                        <button
                            className={`ts-btn ${viewMode === 'full' ? 'active' : ''}`}
                            onClick={() => onViewModeChange('full')}
                        >
                            <LayoutGrid />
                            <span>Full Test</span>
                            {viewMode === 'full' && <div className="ts-active-dot" />}
                        </button>
                        <button
                            className={`ts-btn ${viewMode === 'parts' ? 'active' : ''}`}
                            onClick={() => onViewModeChange('parts')}
                        >
                            <Layers />
                            <span>By Parts</span>
                            {viewMode === 'parts' && <div className="ts-active-dot" />}
                        </button>
                    </div>
                </div>

                {/* Part Filter (only in parts mode with a specific skill selected) */}
                {viewMode === 'parts' && selectedType !== 'all' && (
                    <div className="ts-card">
                        <h3>Filter by Part</h3>
                        <div className="ts-btn-list">
                            {getPartOptions(selectedType).map((opt) => (
                                <button
                                    key={opt.value}
                                    className={`ts-part-option ${selectedPartFilter === opt.value ? 'active' : ''}`}
                                    onClick={() => onPartFilterChange(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {canShowQuestionGroupFilter && (
                    <div className="ts-card">
                        <h3>Filter by Question Group</h3>
                        <div className="ts-btn-list">
                            {safeQuestionGroupOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    className={`ts-part-option ${selectedQuestionGroupFilter === opt.value ? 'active' : ''}`}
                                    onClick={() => onQuestionGroupFilterChange?.(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stats Card */}
                <div className="ts-stats">
                    <div className="ts-stats-header">
                        <p>Your Progress</p>
                        <TrendingUp />
                    </div>
                    <p className="ts-stats-number">
                        {safeCompleted}<span>/{safeTotal}</span>
                    </p>
                    <p className="ts-stats-label">Tests completed</p>
                    <div className="ts-progress-track">
                        <div className="ts-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </div>
        </aside>
    );
}
