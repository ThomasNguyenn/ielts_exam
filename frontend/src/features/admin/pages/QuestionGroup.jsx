import { useMemo } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  ANSWER_LIST_ONLY_TYPES,
  BOOLEAN_GROUP_TYPES,
  GROUP_LAYOUT_OPTIONS,
  GROUP_OPTION_TYPES,
  MATCHING_GROUP_TYPES,
  PLACEHOLDER_SYNC_TYPES,
  REFERENCE_TEXT_TYPES,
} from './questionGroupConfig';

const DEFAULT_OPTIONS = [
  { label: 'A', text: '' },
  { label: 'B', text: '' },
  { label: 'C', text: '' },
  { label: 'D', text: '' },
];

function escapeCellHtml(raw = '') {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br />');
}

function createGrid(rows = 2, columns = 2) {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''));
}

function getTableSegment(rawText = '') {
  const source = String(rawText || '');
  const match = source.match(/<table[\s\S]*?<\/table>/i);
  if (!match) return null;

  const start = match.index ?? 0;
  const end = start + match[0].length;
  return {
    before: source.slice(0, start),
    tableHtml: match[0],
    after: source.slice(end),
  };
}

function parseTableHtmlToGrid(tableHtml = '') {
  if (typeof DOMParser === 'undefined') return null;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(tableHtml, 'text/html');
    const rows = Array.from(doc.querySelectorAll('tr'));
    if (!rows.length) return null;

    const maxColumns = rows.reduce((max, row) => {
      const count = row.querySelectorAll('th,td').length;
      return Math.max(max, count);
    }, 0);

    if (!maxColumns) return null;

    return rows.map((row) => {
      const cells = Array.from(row.querySelectorAll('th,td')).map((cell) => String(cell.textContent || '').trim());
      while (cells.length < maxColumns) cells.push('');
      return cells;
    });
  } catch {
    return null;
  }
}

function gridToTableHtml(grid = []) {
  const rows = grid.length ? grid : createGrid(2, 2);
  const rowMarkup = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeCellHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<table><tbody>${rowMarkup}</tbody></table>`;
}

export default function QuestionGroup({
  group,
  gi,
  totalGroups,
  isGroupCollapsed,
  collapsedQuestions,
  questionTypeOptions,
  onToggleGroupCollapse,
  onToggleQuestionCollapse,
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
  onSyncQuestionsFromText,
  onSyncMultiChoiceCount,
  handleBoldShortcut,
}) {
  const isMatchingType = MATCHING_GROUP_TYPES.has(group.type);
  const isBooleanType = BOOLEAN_GROUP_TYPES.has(group.type);
  const isMultipleChoiceType = group.type === 'mult_choice';
  const isTableCompletionType = group.type === 'table_completion';
  const isAnswerListOnlyType = ANSWER_LIST_ONLY_TYPES.has(group.type);
  const isMultiChoiceMode = group.group_layout === 'checkbox';
  const canSyncPlaceholderQuestions = PLACEHOLDER_SYNC_TYPES.has(group.type);
  const showReferenceText = REFERENCE_TEXT_TYPES.has(group.type) || group.group_layout === 'with_reference';
  const showGroupOptions = GROUP_OPTION_TYPES.has(group.type);
  const groupLabel = questionTypeOptions.find((item) => item.value === group.type)?.label || group.type;
  const booleanAnswerPresets = group.type === 'true_false_notgiven'
    ? ['TRUE', 'FALSE', 'NOT GIVEN']
    : ['YES', 'NO', 'NOT GIVEN'];
  const placeholderSourceLabel = group.type === 'matching_headings' ? 'passage content' : 'reference text';
  const tableSegment = useMemo(() => getTableSegment(group.text || ''), [group.text]);
  const tableGrid = useMemo(
    () => (tableSegment ? parseTableHtmlToGrid(tableSegment.tableHtml) : null),
    [tableSegment]
  );

  const commitTableGrid = (nextGrid) => {
    const nextTable = gridToTableHtml(nextGrid);
    if (!tableSegment) {
      onUpdateGroup(gi, 'text', nextTable);
      return;
    }

    onUpdateGroup(gi, 'text', `${tableSegment.before}${nextTable}${tableSegment.after}`);
  };

  const createNewTable = () => {
    commitTableGrid(createGrid(2, 2));
  };

  const addTableRow = () => {
    const baseGrid = tableGrid || createGrid(2, 2);
    const columns = baseGrid[0]?.length || 2;
    const nextGrid = [...baseGrid, Array.from({ length: columns }, () => '')];
    commitTableGrid(nextGrid);
  };

  const addTableColumn = () => {
    const baseGrid = tableGrid || createGrid(2, 2);
    const nextGrid = baseGrid.map((row) => [...row, '']);
    commitTableGrid(nextGrid);
  };

  const updateTableCell = (rowIndex, colIndex, value) => {
    const baseGrid = tableGrid || createGrid(2, 2);
    const nextGrid = baseGrid.map((row, currentRowIndex) => {
      if (currentRowIndex !== rowIndex) return row;
      return row.map((cell, currentColIndex) => (currentColIndex === colIndex ? value : cell));
    });
    commitTableGrid(nextGrid);
  };

  return (
    <div className="manage-card card-accent-blue" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
      <div
        className="group-header"
        onClick={() => onToggleGroupCollapse(gi)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          borderBottom: isGroupCollapsed ? 'none' : '1px solid #E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <GripVertical size={16} style={{ color: '#94A3B8' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366F1' }}>GROUP {gi + 1}</span>
          <span style={{ fontWeight: 600, color: '#0F172A' }}>{groupLabel}</span>
          <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>• {group.questions.length} questions</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMove(gi, -1)} disabled={gi === 0} title="Move Up">
            ↑
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onMove(gi, 1)}
            disabled={gi === totalGroups - 1}
            title="Move Down"
          >
            ↓
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(gi)} style={{ color: '#EF4444' }} title="Delete Group">
            <Trash2 size={16} />
          </button>
          {isGroupCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </div>
      </div>

      {!isGroupCollapsed && (
        <div className="group-content">
          <div className="form-row">
            <label>Question Type</label>
            <select value={group.type} onChange={(event) => onUpdateGroup(gi, 'type', event.target.value)}>
              {questionTypeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Layout</label>
            <select value={group.group_layout || 'default'} onChange={(event) => onUpdateGroup(gi, 'group_layout', event.target.value)}>
              {GROUP_LAYOUT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {isMultipleChoiceType && (
            <div className="form-row">
              <label>Selection Rule</label>
              <div className="manage-inline-fields">
                <select
                  value={isMultiChoiceMode ? 'multi' : 'single'}
                  onChange={(event) => onUpdateGroup(gi, 'group_layout', event.target.value === 'multi' ? 'checkbox' : 'radio')}
                >
                  <option value="single">Single Answer</option>
                  <option value="multi">Multiple Answers</option>
                </select>
                {isMultiChoiceMode && (
                  <>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={group.required_count ?? ''}
                      onChange={(event) => onUpdateGroup(gi, 'required_count', Number(event.target.value) || '')}
                      placeholder="Choose N"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onSyncMultiChoiceCount?.(gi, Number(group.required_count) || 0)}
                    >
                      Sync Question Slots
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="form-row">
            <label>Instructions</label>
            <textarea
              value={group.instructions || ''}
              onChange={(event) => onUpdateGroup(gi, 'instructions', event.target.value)}
              onKeyDown={(event) => handleBoldShortcut(event, group.instructions || '', (next) => onUpdateGroup(gi, 'instructions', next))}
              rows={2}
              placeholder="Instructions for this question group..."
            />
          </div>

          {showReferenceText && (
            <div className="form-row">
              <label>Reference Text</label>
              <textarea
                value={group.text || ''}
                onChange={(event) => onUpdateGroup(gi, 'text', event.target.value)}
                onKeyDown={(event) => handleBoldShortcut(event, group.text || '', (next) => onUpdateGroup(gi, 'text', next))}
                rows={4}
                placeholder="Optional reference text, summary, map notes, or context..."
              />
            </div>
          )}

          {isTableCompletionType && (
            <div className="form-section">
              <div className="manage-table-builder-header">
                <h4>Table Builder</h4>
                <div className="manage-inline-fields">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={createNewTable}>
                    {tableGrid ? 'Reset Table' : 'Create Table'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addTableRow} disabled={!tableGrid}>
                    Add Row
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addTableColumn} disabled={!tableGrid}>
                    Add Column
                  </button>
                </div>
              </div>

              {!tableGrid && (
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Click "Create Table" to generate a table template. Use placeholders like [1], [2] inside cells.
                </p>
              )}

              {tableGrid && (
                <div className="manage-table-builder-grid">
                  <table>
                    <tbody>
                      {tableGrid.map((row, rowIndex) => (
                        <tr key={`table-row-${rowIndex}`}>
                          {row.map((cell, colIndex) => (
                            <td key={`table-cell-${rowIndex}-${colIndex}`}>
                              <input
                                value={cell}
                                onChange={(event) => updateTableCell(rowIndex, colIndex, event.target.value)}
                                placeholder={rowIndex === 0 ? 'Header or [1]' : 'Cell text or [n]'}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {canSyncPlaceholderQuestions && (
            <div className="form-row">
              <label>Placeholder Sync</label>
              <div className="manage-inline-fields">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onSyncQuestionsFromText?.(gi)}
                >
                  Sync Questions from [n]
                </button>
                <span className="muted">Auto-create rows from placeholders in {placeholderSourceLabel} (e.g. [1], [2], [15])</span>
              </div>
            </div>
          )}

          {isMatchingType && (
            <>
              <div className="form-row">
                <label>Matching Rule</label>
                <div className="manage-inline-fields">
                  <label className="manage-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(group.use_once)}
                      onChange={(event) => onUpdateGroup(gi, 'use_once', event.target.checked)}
                    />
                    <span>Use each option once only</span>
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h4>Headings / Labels</h4>
                {(group.headings || []).map((heading, headingIndex) => (
                  <div key={`${gi}-heading-${headingIndex}`} className="heading-row">
                    <input
                      value={heading.id}
                      onChange={(event) => onUpdateHeading(gi, headingIndex, 'id', event.target.value)}
                      placeholder="ID"
                      className="heading-id"
                    />
                    <input
                      value={heading.text}
                      onChange={(event) => onUpdateHeading(gi, headingIndex, 'text', event.target.value)}
                      placeholder="Heading text"
                      className="heading-text"
                    />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemoveHeading(gi, headingIndex)} style={{ color: '#EF4444' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAddHeading(gi)} style={{ color: '#6366F1' }}>
                  + Add Heading
                </button>
              </div>
            </>
          )}

          {showGroupOptions && (
            <div className="form-section">
              <h4>Options List</h4>
              {(group.options || []).map((option, optionIndex) => (
                <div key={`${gi}-option-${optionIndex}`} className="heading-row">
                  <input
                    value={option.id}
                    onChange={(event) => onUpdateOption(gi, optionIndex, 'id', event.target.value)}
                    placeholder="ID"
                    className="heading-id"
                  />
                  <input
                    value={option.text}
                    onChange={(event) => onUpdateOption(gi, optionIndex, 'text', event.target.value)}
                    placeholder="Option text"
                    className="heading-text"
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemoveOption(gi, optionIndex)} style={{ color: '#EF4444' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAddOption(gi)} style={{ color: '#6366F1' }}>
                + Add Option
              </button>
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ marginBottom: 0 }}>Questions</h4>
              {!isAnswerListOnlyType ? (
                <button type="button" className="btn btn-sm" style={{ background: '#EEF2FF', color: '#4338CA' }} onClick={() => onAddQuestion(gi)}>
                  <Plus size={14} />
                  <span style={{ marginLeft: '0.25rem' }}>Add Question</span>
                </button>
              ) : (
                <span className="muted">Rows are generated from placeholders [n]</span>
              )}
            </div>

            {isAnswerListOnlyType ? (
              <div className="manage-gapfill-answer-list">
                <div className="manage-gapfill-answer-head">
                  <span>ID</span>
                  <span>Correct Answer</span>
                  <span>Explain</span>
                </div>

                {group.questions.length === 0 ? (
                  <div className="manage-gapfill-answer-empty">Press "Sync Questions from [n]" to generate answer rows.</div>
                ) : (
                  group.questions.map((question, questionIndex) => (
                    <div key={`gapfill-answer-${gi}-${questionIndex}`} className="manage-gapfill-answer-row">
                      <div className="manage-gapfill-answer-id">[{question.q_number}]</div>
                      <input
                        value={typeof question.correct_answers_raw === 'string'
                          ? question.correct_answers_raw
                          : (question.correct_answers || []).join(', ')}
                        onChange={(event) => onSetCorrectAnswers(gi, questionIndex, event.target.value)}
                        placeholder="Correct answer (comma-separated if needed)"
                      />
                      <textarea
                        value={question.explanation || ''}
                        onChange={(event) => onUpdateQuestion(gi, questionIndex, 'explanation', event.target.value)}
                        onKeyDown={(event) =>
                          handleBoldShortcut(event, question.explanation || '', (next) => onUpdateQuestion(gi, questionIndex, 'explanation', next))
                        }
                        rows={1}
                        placeholder="Optional explanation"
                      />
                    </div>
                  ))
                )}
              </div>
            ) : group.questions.map((question, questionIndex) => {
              const questionCollapseKey = `${gi}-${questionIndex}`;
              const isQuestionCollapsed = collapsedQuestions.has(questionCollapseKey);
              const questionOptions = Array.isArray(question.option) && question.option.length ? question.option : DEFAULT_OPTIONS;

              return (
                <div key={questionCollapseKey} className="question-block" style={{ marginTop: '0.75rem' }}>
                  <div
                    className="group-header"
                    onClick={() => onToggleQuestionCollapse(gi, questionIndex)}
                    style={{ cursor: 'pointer', borderBottom: 'none', padding: '0.75rem 0.5rem' }}
                  >
                    <span style={{ fontWeight: 700, color: '#4F46E5' }}>Q{question.q_number}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemoveQuestion(gi, questionIndex)} style={{ color: '#EF4444' }}>
                        <Trash2 size={14} />
                      </button>
                      {isQuestionCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </div>
                  </div>

                  {!isQuestionCollapsed && (
                    <div style={{ padding: '0 0.5rem 0.75rem' }}>
                      <div className="form-row">
                        <label>{canSyncPlaceholderQuestions ? 'Question Text (Optional)' : 'Question Text'}</label>
                        <textarea
                          value={question.text || ''}
                          onChange={(event) => onUpdateQuestion(gi, questionIndex, 'text', event.target.value)}
                          onKeyDown={(event) =>
                            handleBoldShortcut(event, question.text || '', (next) => onUpdateQuestion(gi, questionIndex, 'text', next))
                          }
                          rows={canSyncPlaceholderQuestions ? 1 : 2}
                          placeholder={canSyncPlaceholderQuestions ? 'Optional label for this placeholder question' : 'Question text...'}
                        />
                      </div>

                      {group.type === 'mult_choice' && (
                        <div className="form-section" style={{ marginTop: '0.75rem' }}>
                          <h4>Options</h4>
                          {questionOptions.map((option, optionIndex) => (
                            <div key={`${questionCollapseKey}-option-${optionIndex}`} className="option-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span style={{ minWidth: 18, fontWeight: 700, color: '#6366F1' }}>{option.label}</span>
                              <input
                                value={option.text}
                                onChange={(event) => onSetQuestionOption(gi, questionIndex, optionIndex, event.target.value)}
                                placeholder={`Option ${option.label}`}
                                className="manage-input-field"
                              />
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemoveQuestionOption(gi, questionIndex, optionIndex)} style={{ color: '#EF4444' }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '0.35rem', color: '#6366F1' }} onClick={() => onAddQuestionOption(gi, questionIndex)}>
                            + Add Option
                          </button>
                        </div>
                      )}

                      <div className="form-row" style={{ marginTop: '0.75rem' }}>
                        <label>Correct Answer(s)</label>
                        <input
                          value={typeof question.correct_answers_raw === 'string'
                            ? question.correct_answers_raw
                            : (question.correct_answers || []).join(', ')}
                          onChange={(event) => onSetCorrectAnswers(gi, questionIndex, event.target.value)}
                          placeholder={
                            group.type === 'true_false_notgiven'
                              ? 'TRUE / FALSE / NOT GIVEN'
                              : group.type === 'yes_no_notgiven'
                                ? 'YES / NO / NOT GIVEN'
                                : (isMultipleChoiceType && isMultiChoiceMode)
                                  ? 'e.g. A, C'
                                  : 'Comma-separated answers'
                          }
                        />
                        {isBooleanType && (
                          <div className="manage-inline-fields" style={{ marginTop: '0.35rem' }}>
                            {booleanAnswerPresets.map((value) => (
                              <button
                                key={`${questionCollapseKey}-preset-${value}`}
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => onSetCorrectAnswers(gi, questionIndex, value)}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="form-row">
                        <label>Explanation</label>
                        <textarea
                          value={question.explanation || ''}
                          onChange={(event) => onUpdateQuestion(gi, questionIndex, 'explanation', event.target.value)}
                          onKeyDown={(event) =>
                            handleBoldShortcut(event, question.explanation || '', (next) => onUpdateQuestion(gi, questionIndex, 'explanation', next))
                          }
                          rows={2}
                          placeholder="Optional explanation"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
