import React from 'react';
import { Trash2 } from 'lucide-react';

const Icons = {
    Writing: () => (
        <svg className="manage-nav-icon" style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
    )
};

const QUESTION_GROUP_TYPES = [
    { value: 'mult_choice', label: 'Multiple choice' },
    { value: 'true_false_notgiven', label: 'True / False / Not given' },
    { value: 'gap_fill', label: 'Gap fill' },
    { value: 'matching_headings', label: 'Matching headings' },
    { value: 'matching_features', label: 'Matching features' },
    { value: 'matching_information', label: 'Matching information' },
    { value: 'summary_completion', label: 'Summary completion' },
    { value: 'listening_map', label: 'Listening Map' },
];

export default function QuestionGroup({
    group,
    gi,
    totalGroups,
    isGroupCollapsed,
    collapsedQuestions,
    onToggleCollapse,
    onMove,
    onRemove,
    onUpdateGroup,
    onUpdateQuestion,
    onAddQuestion,
    onRemoveQuestion,
    onSetQuestionOption,
    onSetCorrectAnswers,
    onAddHeading,
    onRemoveHeading,
    onUpdateHeading,
    onAddOption,
    onRemoveOption,
    onUpdateOption,
    onAddQuestionOption,
    onRemoveQuestionOption,
    onSetMultiSelectMode,
    handleBoldShortcut
}) {
    return (
        <div className="question-group-block">
            <div className="group-header" onClick={() => onToggleCollapse(gi)} style={{ padding: '0.5rem 0.3rem', borderRadius: '0.5rem' }} >
                <div className="group-title p-4">
                    <Icons.Writing /> Question Group {gi + 1} ({group.type})
                </div>
                <div className="item-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onMove(gi, -1); }} disabled={gi === 0}>▲</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onMove(gi, 1); }} disabled={gi === totalGroups - 1}>▼</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onRemove(gi); }} disabled={totalGroups <= 1} style={{ color: '#ef4444', fontWeight: 700 }}>Xóa nhóm</button>
                    <span style={{ marginLeft: '0.5rem', opacity: 0.5 }}>{isGroupCollapsed ? '▼' : '▲'}</span>
                </div>
            </div>
            {!isGroupCollapsed && (
                <div className="group-content">
                    <div className="form-row">
                        <label>Loại câu hỏi</label>
                        <select value={group.type} onChange={(e) => onUpdateGroup(gi, 'type', e.target.value)}>
                            {QUESTION_GROUP_TYPES.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {group.type === 'mult_choice' && (
                        <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #bae6fd' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                <label style={{ fontWeight: 'bold', color: '#0369a1' }}>Question Format:</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name={`q-mode-${gi}`}
                                        checked={group.group_layout === 'radio' || (!group.group_layout && group.questions.length === 1)}
                                        onChange={() => onSetMultiSelectMode(gi, 'radio')}
                                    />
                                    <span>Single Answer (Radio)</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name={`q-mode-${gi}`}
                                        checked={group.group_layout === 'checkbox' || (!group.group_layout && group.questions.length > 1)}
                                        onChange={() => onSetMultiSelectMode(gi, 'checkbox', 2)}
                                    />
                                    <span>Choose Multiple (Checkbox)</span>
                                </label>
                            </div>

                            {(group.group_layout === 'checkbox' || (!group.group_layout && group.questions.length > 1)) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '0.5rem' }}>
                                    <label>Number of answers needed:</label>
                                    <input
                                        type="number"
                                        min="2" max="10"
                                        value={group.questions.length}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 2;
                                            if (val >= 2) onSetMultiSelectMode(gi, 'checkbox', val);
                                        }}
                                        style={{ width: '60px', padding: '0.25rem' }}
                                    />
                                    <span style={{ fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
                                        (This will create {group.questions.length} questions sharing the same options.)
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="form-row">
                        <label>Hướng dẫn (Instructions)</label>
                        <textarea
                            value={group.instructions}
                            onChange={(e) => onUpdateGroup(gi, 'instructions', e.target.value)}
                            onKeyDown={(e) => handleBoldShortcut(e, group.instructions, (next) => onUpdateGroup(gi, 'instructions', next))}
                            rows={2}
                        />
                    </div>

                    {(group.type === 'summary_completion' || group.type === 'gap_fill' || (group.type === 'mult_choice' && group.questions.length > 1)) && (
                        <div className="form-row">
                            <label>
                                {group.type === 'mult_choice' ? 'Nội dung câu hỏi chung (Prompt)' : 'Nội dung đoạn văn có lỗ hổng (Ví dụ: [1], [2])'}
                            </label>
                            <textarea
                                value={group.text}
                                onChange={(e) => onUpdateGroup(gi, 'text', e.target.value)}
                                onKeyDown={(e) => handleBoldShortcut(e, group.text, (next) => onUpdateGroup(gi, 'text', next))}
                                rows={4}
                                placeholder={group.type === 'mult_choice' ? "Enter the common question prompt here..." : ""}
                            />
                        </div>
                    )}

                    {(group.type === 'matching_headings' || group.type === 'matching_features' || group.type === 'matching_information') && (
                        <div className="form-section">
                            <h4>{group.type === 'matching_headings' ? 'Danh sách Headings' : group.type === 'matching_information' ? 'Danh sách Paragraphs' : 'Danh sách Features'}</h4>
                            <p className="form-hint">Thêm các lựa chọn để học viên nối. Đáp án đúng của mỗi câu hỏi sẽ là ID (ví dụ: i, ii, iii hoặc A, B, C).</p>
                            {(group.headings || []).map((h, hi) => (
                                <div key={hi} className="heading-row">
                                    <input
                                        value={h.id}
                                        onChange={(e) => onUpdateHeading(gi, hi, 'id', e.target.value)}
                                        placeholder="ID"
                                        className="heading-id"
                                    />
                                    <textarea
                                        value={h.text}
                                        onChange={(e) => onUpdateHeading(gi, hi, 'text', e.target.value)}
                                        onKeyDown={(e) => handleBoldShortcut(e, h.text, (next) => onUpdateHeading(gi, hi, 'text', next))}
                                        placeholder={group.type === 'matching_information' ? "e.g. Paragraph A" : "Nội dung heading hoặc feature..."}
                                        className="heading-text"
                                        rows={1}
                                        onInput={(e) => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                    />
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemoveHeading(gi, hi)} style={{ color: '#ef4444' }}>Xóa</button>
                                </div>
                            ))}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAddHeading(gi)}>+ Thêm hàng mới</button>
                        </div>
                    )}

                    {group.type === 'summary_completion' && (
                        <div className="form-section">
                            <h4>Danh sách lựa chọn (Options)</h4>
                            <p className="form-hint">Nếu bài điền từ có danh sách từ cho sẵn, hãy thêm ở đây.</p>
                            {(group.options || []).map((o, oi) => (
                                <div key={oi} className="heading-row">
                                    <input
                                        value={o.id}
                                        onChange={(e) => onUpdateOption(gi, oi, 'id', e.target.value)}
                                        placeholder="ID"
                                        className="heading-id"
                                    />
                                    <textarea
                                        value={o.text}
                                        onChange={(e) => onUpdateOption(gi, oi, 'text', e.target.value)}
                                        onKeyDown={(e) => handleBoldShortcut(e, o.text, (next) => onUpdateOption(gi, oi, 'text', next))}
                                        placeholder="Nội dung lựa chọn..."
                                        className="heading-text"
                                        rows={1}
                                        onInput={(e) => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                    />
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemoveOption(gi, oi)} style={{ color: '#ef4444' }}>Xóa</button>
                                </div>
                            ))}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAddOption(gi)}>+ Thêm lựa chọn</button>
                        </div>
                    )}

                    {group.questions.map((q, qi) => {
                        const isQuestionCollapsed = collapsedQuestions.has(`${gi}-${qi}`);
                        return (
                            <div key={qi} className="question-block" style={{ border: '1px solid #E0E7FF', background: '#EEF2FF', padding: '1rem', borderRadius: '1rem', marginBottom: '1.5rem' }}>
                                <div className="group-header" onClick={() => onToggleCollapse(gi, qi)} style={{ padding: '0.5rem 0.3rem', borderRadius: '0.5rem', background: 'transparent', borderBottom: 'none' }}>
                                    <span style={{ fontWeight: 800, color: '#6366F1' }}>Câu {q.q_number}</span>
                                    <span style={{ opacity: 0.5 }}>{isQuestionCollapsed ? '▼' : '▲'}</span>
                                </div>
                                {!isQuestionCollapsed && (
                                    <div className="form-row">
                                        <label>Nội dung câu hỏi</label>
                                        <textarea
                                            value={q.text}
                                            onChange={(e) => onUpdateQuestion(gi, qi, 'text', e.target.value)}
                                            onKeyDown={(e) => handleBoldShortcut(e, q.text, (next) => onUpdateQuestion(gi, qi, 'text', next))}
                                            rows={2}
                                            placeholder="Nhập câu hỏi..."
                                        />

                                        {/* Options for Mult Choice */}
                                        {group.type === 'mult_choice' && (
                                            <div className="options-list">
                                                <label>Lựa chọn (A, B, C...)</label>
                                                {/* If checkbox mode, all questions share options. Only show for first question OR if not checkbox mode */}
                                                {(group.group_layout !== 'checkbox' || qi === 0) ? (
                                                    <>
                                                        {(q.option || []).map((opt, oi) => (
                                                            <div key={oi} className="option-row" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                                <span style={{ fontWeight: 600, width: '20px', display: 'flex', alignItems: 'center' }}>{opt.label}</span>
                                                                <input
                                                                    value={opt.text}
                                                                    onChange={(e) => onSetQuestionOption(gi, qi, oi, e.target.value)}
                                                                    placeholder={`Option ${opt.label}`}
                                                                    style={{ flex: 1 }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-ghost btn-sm"
                                                                    onClick={() => onRemoveQuestionOption(gi, qi, oi)}
                                                                    style={{ color: '#ef4444', padding: '0.2rem' }}
                                                                    title="Remove option"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ fontSize: '0.8rem', color: '#6366F1' }}
                                                            onClick={() => onAddQuestionOption(gi, qi)}
                                                        >
                                                            + Add Option
                                                        </button>
                                                    </>
                                                ) : (
                                                    <p style={{ fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>Options are shared with the first question in this group.</p>
                                                )}
                                            </div>
                                        )}


                                        <div className="form-row">
                                            <label>Đáp án đúng (Correct Answers)</label>
                                            <input
                                                value={(q.correct_answers || []).join(', ')}
                                                onChange={(e) => onSetCorrectAnswers(gi, qi, e.target.value)}
                                                placeholder="e.g. A, C (ngăn cách bằng dấu phẩy)"
                                            />
                                        </div>
                                        <div className="form-row">
                                            <label>Giải thích (Explanation)</label>
                                            <textarea
                                                value={q.explanation}
                                                onChange={(e) => onUpdateQuestion(gi, qi, 'explanation', e.target.value)}
                                                onKeyDown={(e) => handleBoldShortcut(e, q.explanation, (next) => onUpdateQuestion(gi, qi, 'explanation', next))}
                                                rows={2}
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            style={{ color: '#ef4444', marginTop: '0.5rem' }}
                                            onClick={() => onRemoveQuestion(gi, qi)}
                                            disabled={group.questions.length <= 1 && group.group_layout !== 'checkbox'}
                                        >
                                            Xóa câu hỏi này
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {(!group.group_layout || group.group_layout === 'radio') && (
                        <button type="button" className="btn btn-secondary" onClick={() => onAddQuestion(gi)} style={{ width: '100%', marginTop: '1rem' }}>
                            + Thêm câu hỏi vào nhóm này
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
