import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  ANSWER_LIST_ONLY_TYPES,
  BOOLEAN_GROUP_TYPES,
  GROUP_LAYOUT_OPTIONS,
  GROUP_OPTION_TYPES,
  MATCHING_GROUP_TYPES,
  PLACEHOLDER_SYNC_TYPES,
  REFERENCE_TEXT_TYPES,
} from '../utils/questionGroupConfig';
import { buildMatchingInformationHeadingsFromRange, parseCorrectAnswersRaw } from '../utils/manageQuestionInputUtils';

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

function normalizeOptionToken(raw = '') {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function dedupeOptionIds(values = []) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const normalized = normalizeOptionToken(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function resolveCanonicalOptionId(options = [], rawToken = '') {
  const normalized = normalizeOptionToken(rawToken);
  if (!normalized) return '';

  for (const option of options || []) {
    const label = normalizeOptionToken(option?.label || option?.id || '');
    if (label && label === normalized) return label;
  }

  for (const option of options || []) {
    const text = normalizeOptionToken(option?.text || '');
    const label = normalizeOptionToken(option?.label || option?.id || '');
    if (text && label && text === normalized) return label;
  }

  return normalized;
}

function getQuestionOptionIds(question = {}, options = []) {
  const fromArray = Array.isArray(question?.correct_answers) ? question.correct_answers : [];
  const fromRaw = parseCorrectAnswersRaw(question?.correct_answers_raw || '');
  const source = fromArray.length ? fromArray : fromRaw;
  const canonical = source.map((token) => resolveCanonicalOptionId(options, token));
  return dedupeOptionIds(canonical);
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
  onSetMultiChoiceCorrectAnswers,
  onSyncMultiChoiceSharedQuestion,
  onUpdateGroupSteps,
  onUploadDiagramImage,
  showPassageReferenceField = false,
  handleBoldShortcut,
}) {
  const isMatchingType = MATCHING_GROUP_TYPES.has(group.type);
  const isMatchingInformationType = group.type === 'matching_information';
  const isBooleanType = BOOLEAN_GROUP_TYPES.has(group.type);
  const isMultipleChoiceType = group.type === 'mult_choice';
  const isTableCompletionType = group.type === 'table_completion';
  const isDiagramLabelType = group.type === 'diagram_label_completion';
  const isListeningMapType = group.type === 'listening_map';
  const supportsGroupImage = isDiagramLabelType || isListeningMapType;
  const isFlowOrPlanType = group.type === 'flow_chart_completion' || group.type === 'plan_map_diagram';
  const isAnswerListOnlyType = ANSWER_LIST_ONLY_TYPES.has(group.type);
  const isMultiChoiceMode = group.group_layout === 'checkbox';
  const multiChoiceLayoutOptions = GROUP_LAYOUT_OPTIONS.filter((item) => item.value === 'radio' || item.value === 'checkbox');
  const activeLayoutOptions = isMultipleChoiceType ? multiChoiceLayoutOptions : GROUP_LAYOUT_OPTIONS;
  const normalizedLayoutValue = isMultipleChoiceType
    ? (group.group_layout === 'checkbox' ? 'checkbox' : 'radio')
    : (group.group_layout || 'default');
  const canSyncPlaceholderQuestions = (PLACEHOLDER_SYNC_TYPES.has(group.type) || isFlowOrPlanType) && !isDiagramLabelType;
  const showReferenceText = (REFERENCE_TEXT_TYPES.has(group.type) || group.group_layout === 'with_reference')
    && !isDiagramLabelType
    && !isListeningMapType
    && !isFlowOrPlanType;
  const showGroupOptions = GROUP_OPTION_TYPES.has(group.type);
  const showDiagramQuestionTextInput = isDiagramLabelType;
  const allowManualQuestionRows = isDiagramLabelType;
  const groupLabel = questionTypeOptions.find((item) => item.value === group.type)?.label || group.type;
  const booleanAnswerPresets = group.type === 'true_false_notgiven'
    ? ['TRUE', 'FALSE', 'NOT GIVEN']
    : ['YES', 'NO', 'NOT GIVEN'];
  const placeholderSourceLabel = isFlowOrPlanType
    ? 'step list'
    : (group.type === 'matching_headings' ? 'passage content' : 'reference text');

  const tableSegment = useMemo(() => getTableSegment(group.text || ''), [group.text]);
  const tableGrid = useMemo(() => (tableSegment ? parseTableHtmlToGrid(tableSegment.tableHtml) : null), [tableSegment]);

  const [rangeInput, setRangeInput] = useState('');
  const [rangeError, setRangeError] = useState('');
  const [isUploadingDiagramImage, setIsUploadingDiagramImage] = useState(false);

  const commitTableGrid = (nextGrid) => {
    const nextTable = gridToTableHtml(nextGrid);
    if (!tableSegment) {
      onUpdateGroup(gi, 'text', nextTable);
      return;
    }
    onUpdateGroup(gi, 'text', `${tableSegment.before}${nextTable}${tableSegment.after}`);
  };

  const createNewTable = () => commitTableGrid(createGrid(2, 2));

  const addTableRow = () => {
    const baseGrid = tableGrid || createGrid(2, 2);
    const columns = baseGrid[0]?.length || 2;
    commitTableGrid([...baseGrid, Array.from({ length: columns }, () => '')]);
  };

  const addTableColumn = () => {
    const baseGrid = tableGrid || createGrid(2, 2);
    commitTableGrid(baseGrid.map((row) => [...row, '']));
  };

  const updateTableCell = (rowIndex, colIndex, value) => {
    const baseGrid = tableGrid || createGrid(2, 2);
    const nextGrid = baseGrid.map((row, currentRowIndex) => {
      if (currentRowIndex !== rowIndex) return row;
      return row.map((cell, currentColIndex) => (currentColIndex === colIndex ? value : cell));
    });
    commitTableGrid(nextGrid);
  };

  const generateMatchingHeadingsFromRange = () => {
    const result = buildMatchingInformationHeadingsFromRange(rangeInput);
    if (!result.ok) {
      setRangeError(result.error || 'Invalid range.');
      return;
    }
    setRangeError('');
    onUpdateGroup(gi, 'headings', result.headings);
  };

  const normalizedSteps = useMemo(
    () => (Array.isArray(group.steps) ? group.steps.map((step) => String(step ?? '')) : []),
    [group.steps],
  );

  const updateSteps = (nextSteps = []) => {
    const safeSteps = Array.isArray(nextSteps) ? nextSteps.map((step) => String(step ?? '')) : [];
    if (typeof onUpdateGroupSteps === 'function') {
      onUpdateGroupSteps(gi, safeSteps);
      return;
    }
    onUpdateGroup(gi, 'steps', safeSteps);
  };

  const handleDiagramImageUpload = async (event) => {
    const file = event.target?.files?.[0];
    if (!file || typeof onUploadDiagramImage !== 'function') {
      if (event.target) event.target.value = '';
      return;
    }

    setIsUploadingDiagramImage(true);
    try {
      await onUploadDiagramImage(gi, file);
    } finally {
      setIsUploadingDiagramImage(false);
      if (event.target) event.target.value = '';
    }
  };

  const shouldUseSharedMultiChoiceEditor = isMultipleChoiceType && isMultiChoiceMode;
  const sharedQuestion = shouldUseSharedMultiChoiceEditor ? (group.questions?.[0] || null) : null;
  const sharedOptions = Array.isArray(sharedQuestion?.option) && sharedQuestion.option.length ? sharedQuestion.option : DEFAULT_OPTIONS;
  const sharedSelectedOptionIds = sharedQuestion ? getQuestionOptionIds(sharedQuestion, sharedOptions) : [];
  const parsedRequiredCount = Number(group.required_count);
  const requiredSelectionCount = Number.isFinite(parsedRequiredCount) && parsedRequiredCount > 0
    ? parsedRequiredCount
    : Math.max(1, group.questions?.length || 1);

  const applySharedOptionsPatch = (updater, { syncSelection = true } = {}) => {
    if (!sharedQuestion || typeof onSyncMultiChoiceSharedQuestion !== 'function') return;
    const nextOptions = updater(sharedOptions).map((option, index) => ({
      ...option,
      label: String.fromCharCode(65 + index),
    }));
    onSyncMultiChoiceSharedQuestion(gi, { option: nextOptions });

    if (syncSelection && typeof onSetMultiChoiceCorrectAnswers === 'function') {
      const availableIds = new Set(nextOptions.map((option) => normalizeOptionToken(option.label || option.id || '')));
      const nextSelectedIds = sharedSelectedOptionIds.filter((id) => availableIds.has(normalizeOptionToken(id)));
      onSetMultiChoiceCorrectAnswers(gi, nextSelectedIds);
    }
  };

  return (
    <Card className='border-border/70 shadow-none'>
      <CardHeader className='cursor-pointer py-4' onClick={() => onToggleGroupCollapse(gi)}>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <GripVertical className='h-4 w-4 text-muted-foreground' />
            <Badge variant='outline'>GROUP {gi + 1}</Badge>
            <CardTitle className='text-base'>{groupLabel}</CardTitle>
            <span className='text-xs text-muted-foreground'>- {group.questions.length} questions</span>
          </div>
          <div className='flex items-center gap-1' onClick={(event) => event.stopPropagation()}>
            <Button type='button' size='sm' variant='ghost' onClick={() => onMove(gi, -1)} disabled={gi === 0}>↑</Button>
            <Button type='button' size='sm' variant='ghost' onClick={() => onMove(gi, 1)} disabled={gi === totalGroups - 1}>↓</Button>
            <Button type='button' size='sm' variant='ghost' onClick={() => onRemove(gi)} className='text-destructive'>
              <Trash2 className='h-4 w-4' />
            </Button>
            {isGroupCollapsed ? <ChevronDown className='h-4 w-4' /> : <ChevronUp className='h-4 w-4' />}
          </div>
        </div>
      </CardHeader>

      {!isGroupCollapsed ? (
        <CardContent className='space-y-4 pt-0'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label>Question Type</Label>
              <Select value={group.type} onValueChange={(value) => onUpdateGroup(gi, 'type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder='Select type' />
                </SelectTrigger>
                <SelectContent>
                  {questionTypeOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label>Layout</Label>
              <Select
                value={normalizedLayoutValue}
                onValueChange={(value) => onUpdateGroup(gi, 'group_layout', isMultipleChoiceType ? (value === 'checkbox' ? 'checkbox' : 'radio') : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Layout' />
                </SelectTrigger>
                <SelectContent>
                  {activeLayoutOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isMultipleChoiceType ? (
            <div className='space-y-2'>
              <Label>Selection Rule</Label>
              <div className='flex flex-wrap items-center gap-2'>
                <Select
                  value={isMultiChoiceMode ? 'multi' : 'single'}
                  onValueChange={(value) => onUpdateGroup(gi, 'group_layout', value === 'multi' ? 'checkbox' : 'radio')}
                >
                  <SelectTrigger className='w-[220px]'>
                    <SelectValue placeholder='Rule' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='single'>Single Answer</SelectItem>
                    <SelectItem value='multi'>MultiChoice</SelectItem>
                  </SelectContent>
                </Select>
                {isMultiChoiceMode ? (
                  <>
                    <Input
                      type='number'
                      min={2}
                      max={20}
                      value={group.required_count ?? ''}
                      onChange={(event) => onUpdateGroup(gi, 'required_count', Number(event.target.value) || '')}
                      placeholder='Choose N'
                      className='w-[140px]'
                    />
                    <Button type='button' variant='outline' size='sm' onClick={() => onSyncMultiChoiceCount?.(gi, Number(group.required_count) || 0)}>
                      Sync Question Slots
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className='space-y-2'>
            <Label>Instructions</Label>
            <Textarea
              value={group.instructions || ''}
              onChange={(event) => onUpdateGroup(gi, 'instructions', event.target.value)}
              onKeyDown={(event) => handleBoldShortcut(event, group.instructions || '', (next) => onUpdateGroup(gi, 'instructions', next))}
              rows={2}
              placeholder='Instructions for this question group...'
            />
          </div>

          {showReferenceText ? (
            <div className='space-y-2'>
              <Label>Reference Text</Label>
              <Textarea
                value={group.text || ''}
                onChange={(event) => onUpdateGroup(gi, 'text', event.target.value)}
                onKeyDown={(event) => handleBoldShortcut(event, group.text || '', (next) => onUpdateGroup(gi, 'text', next))}
                rows={4}
                placeholder='Optional reference text, map notes, or context...'
              />
            </div>
          ) : null}

          {supportsGroupImage ? (
            <Card className='border-dashed'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>{isListeningMapType ? 'Map Image' : 'Diagram Image'}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='space-y-2'>
                  <Label>Image URL</Label>
                  <Input
                    value={group.image_url || ''}
                    onChange={(event) => onUpdateGroup(gi, 'image_url', event.target.value)}
                    placeholder='https://...'
                  />
                </div>
                <div className='space-y-2'>
                  <Label>Upload Image</Label>
                  <Input
                    type='file'
                    accept='image/jpeg,image/png,image/webp'
                    onChange={handleDiagramImageUpload}
                    disabled={isUploadingDiagramImage}
                  />
                  <p className='text-xs text-muted-foreground'>
                    {isUploadingDiagramImage ? 'Uploading image...' : 'Allowed formats: JPG, PNG, WEBP (max 5MB).'}
                  </p>
                </div>
                {group.image_url ? (
                  <div className='overflow-hidden rounded-lg border border-border/70 bg-muted/20'>
                    <img
                      src={group.image_url}
                      alt={isListeningMapType ? 'Map preview' : 'Diagram preview'}
                      className='max-h-[320px] w-full object-contain'
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {isFlowOrPlanType ? (
            <Card className='border-dashed'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>List Steps</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {normalizedSteps.length === 0 ? (
                  <div className='rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
                    No steps yet. Add steps and include placeholders like [1], [2], ... to sync questions.
                  </div>
                ) : (
                  normalizedSteps.map((step, stepIndex) => (
                    <div key={`${gi}-step-${stepIndex}`} className='flex items-start gap-2'>
                      <Badge variant='outline' className='mt-2'>{stepIndex + 1}</Badge>
                      <Textarea
                        value={step}
                        onChange={(event) => {
                          const next = [...normalizedSteps];
                          next[stepIndex] = event.target.value;
                          updateSteps(next);
                        }}
                        onKeyDown={(event) => handleBoldShortcut(event, step, (nextStep) => {
                          const next = [...normalizedSteps];
                          next[stepIndex] = nextStep;
                          updateSteps(next);
                        })}
                        rows={2}
                        placeholder='Step content with placeholders, e.g. The process starts at [1].'
                        className='flex-1'
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='mt-1 text-destructive'
                        onClick={() => updateSteps(normalizedSteps.filter((_, index) => index !== stepIndex))}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  ))
                )}
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => updateSteps([...normalizedSteps, ''])}
                >
                  + Add Step
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isTableCompletionType ? (
            <Card className='border-dashed'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>Table Builder</CardTitle>
                <div className='flex flex-wrap items-center gap-2'>
                  <Button type='button' variant='outline' size='sm' onClick={createNewTable}>{tableGrid ? 'Reset Table' : 'Create Table'}</Button>
                  <Button type='button' variant='outline' size='sm' onClick={addTableRow} disabled={!tableGrid}>Add Row</Button>
                  <Button type='button' variant='outline' size='sm' onClick={addTableColumn} disabled={!tableGrid}>Add Column</Button>
                </div>
              </CardHeader>
              <CardContent>
                {!tableGrid ? (
                  <p className='text-sm text-muted-foreground'>Create table, then put placeholders like [1], [2] in cells.</p>
                ) : (
                  <div className='overflow-x-auto'>
                    <table className='w-full border-collapse'>
                      <tbody>
                        {tableGrid.map((row, rowIndex) => (
                          <tr key={`table-row-${rowIndex}`}>
                            {row.map((cell, colIndex) => (
                              <td key={`table-cell-${rowIndex}-${colIndex}`} className='border p-1'>
                                <Input
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
              </CardContent>
            </Card>
          ) : null}

          {canSyncPlaceholderQuestions ? (
            <div className='rounded-md border p-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <Button type='button' variant='outline' size='sm' onClick={() => onSyncQuestionsFromText?.(gi)}>
                  Sync Questions from [n]
                </Button>
                <span className='text-xs text-muted-foreground'>Create rows from placeholders in {placeholderSourceLabel}.</span>
              </div>
            </div>
          ) : null}

          {isMatchingType ? (
            <Card className='border-dashed'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>Matching Config</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor={`use-once-${gi}`}>Use each option once only</Label>
                  <Switch
                    id={`use-once-${gi}`}
                    checked={Boolean(group.use_once)}
                    onCheckedChange={(checked) => onUpdateGroup(gi, 'use_once', checked)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label>Headings / Labels</Label>
                  {isMatchingInformationType ? (
                    <div className='space-y-2'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Input
                          value={rangeInput}
                          onChange={(event) => {
                            setRangeInput(event.target.value);
                            if (rangeError) setRangeError('');
                          }}
                          placeholder='A-G or I-VII'
                          className='w-[200px]'
                        />
                        <Button type='button' variant='outline' size='sm' onClick={generateMatchingHeadingsFromRange}>Generate</Button>
                      </div>
                      <p className='text-xs text-muted-foreground'>Supported ranges: A-Z and Roman I-X.</p>
                      {rangeError ? <p className='text-xs text-destructive'>{rangeError}</p> : null}
                    </div>
                  ) : null}

                  {(group.headings || []).map((heading, headingIndex) => (
                    <div key={`${gi}-heading-${headingIndex}`} className='flex flex-wrap items-center gap-2'>
                      <Input
                        value={heading.id}
                        onChange={(event) => onUpdateHeading(gi, headingIndex, 'id', event.target.value)}
                        placeholder='ID'
                        className='w-24'
                      />
                      <Input
                        value={heading.text}
                        onChange={(event) => onUpdateHeading(gi, headingIndex, 'text', event.target.value)}
                        placeholder='Heading text'
                        className='min-w-[260px] flex-1'
                      />
                      <Button type='button' variant='ghost' size='icon' onClick={() => onRemoveHeading(gi, headingIndex)} className='text-destructive'>
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}

                  <Button type='button' size='sm' variant='outline' onClick={() => onAddHeading(gi)}>+ Add Heading</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {showGroupOptions ? (
            <Card className='border-dashed'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>Options List</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2'>
                {(group.options || []).map((option, optionIndex) => (
                  <div key={`${gi}-option-${optionIndex}`} className='flex flex-wrap items-center gap-2'>
                    <Input
                      value={option.id}
                      onChange={(event) => onUpdateOption(gi, optionIndex, 'id', event.target.value)}
                      placeholder='ID'
                      className='w-24'
                    />
                    <Input
                      value={option.text}
                      onChange={(event) => onUpdateOption(gi, optionIndex, 'text', event.target.value)}
                      placeholder='Option text'
                      className='min-w-[260px] flex-1'
                    />
                    <Button type='button' variant='ghost' size='icon' onClick={() => onRemoveOption(gi, optionIndex)} className='text-destructive'>
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
                <Button type='button' size='sm' variant='outline' onClick={() => onAddOption(gi)}>+ Add Option</Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className='border-dashed'>
            <CardHeader className='flex flex-row items-center justify-between pb-3'>
              <CardTitle className='text-base'>Questions</CardTitle>
              {!isAnswerListOnlyType || allowManualQuestionRows ? (
                <Button type='button' size='sm' onClick={() => onAddQuestion(gi)}>
                  <Plus className='mr-1 h-4 w-4' />
                  Add Question
                </Button>
              ) : (
                <span className='text-xs text-muted-foreground'>Rows are generated from placeholders [n]</span>
              )}
            </CardHeader>

            <CardContent className='space-y-3'>
              {isAnswerListOnlyType ? (
                <div className='space-y-2'>
                  {group.questions.length === 0 ? (
                    <div className='rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground'>
                      {isDiagramLabelType
                        ? 'Add question rows to match diagram input slots.'
                        : 'Press "Sync Questions from [n]" to generate answer rows.'}
                    </div>
                  ) : (
                    group.questions.map((question, questionIndex) => (
                      isDiagramLabelType ? (
                        <div
                          key={`diagram-answer-${gi}-${questionIndex}`}
                          className='grid gap-2 rounded-md border p-3 md:grid-cols-12'
                        >
                          <div className='flex items-center text-sm font-semibold text-muted-foreground md:col-span-1'>
                            Q{question.q_number}
                          </div>
                          {showDiagramQuestionTextInput ? (
                            <Input
                              className='md:col-span-4'
                              value={question.text || ''}
                              onChange={(event) => onUpdateQuestion(gi, questionIndex, 'text', event.target.value)}
                              placeholder='Optional label (can be empty)'
                            />
                          ) : null}
                          <Input
                            className='md:col-span-3'
                            value={typeof question.correct_answers_raw === 'string' ? question.correct_answers_raw : (question.correct_answers || []).join(', ')}
                            onChange={(event) => onSetCorrectAnswers(gi, questionIndex, event.target.value)}
                            placeholder='Correct answer'
                          />
                          <Textarea
                            className='md:col-span-3'
                            value={question.explanation || ''}
                            onChange={(event) => onUpdateQuestion(gi, questionIndex, 'explanation', event.target.value)}
                            onKeyDown={(event) => handleBoldShortcut(event, question.explanation || '', (next) => onUpdateQuestion(gi, questionIndex, 'explanation', next))}
                            rows={1}
                            placeholder='Explanation'
                          />
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='md:col-span-1 text-destructive'
                            onClick={() => onRemoveQuestion(gi, questionIndex)}
                            disabled={group.questions.length <= 1}
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      ) : (
                        <div
                          key={`gapfill-answer-${gi}-${questionIndex}`}
                          className={`grid gap-2 rounded-md border p-3 ${isMatchingType ? 'md:grid-cols-10' : 'md:grid-cols-4'}`}
                        >
                          <div className={`text-sm font-semibold text-muted-foreground ${isMatchingType ? 'md:col-span-1' : ''}`}>[{question.q_number}]</div>
                          <Input
                            className={isMatchingType ? 'md:col-span-1' : ''}
                            value={typeof question.correct_answers_raw === 'string' ? question.correct_answers_raw : (question.correct_answers || []).join(', ')}
                            onChange={(event) => onSetCorrectAnswers(gi, questionIndex, event.target.value)}
                            placeholder='Correct answer'
                          />
                          {showPassageReferenceField ? (
                            <Textarea
                              className={isMatchingType ? 'md:col-span-4' : ''}
                              value={question.passage_reference || ''}
                              onChange={(event) => onUpdateQuestion(gi, questionIndex, 'passage_reference', event.target.value)}
                              onKeyDown={(event) => handleBoldShortcut(event, question.passage_reference || '', (next) => onUpdateQuestion(gi, questionIndex, 'passage_reference', next))}
                              rows={1}
                              placeholder='Passage reference'
                            />
                          ) : null}
                          <Textarea
                            className={isMatchingType ? (showPassageReferenceField ? 'md:col-span-4' : 'md:col-span-8') : ''}
                            value={question.explanation || ''}
                            onChange={(event) => onUpdateQuestion(gi, questionIndex, 'explanation', event.target.value)}
                            onKeyDown={(event) => handleBoldShortcut(event, question.explanation || '', (next) => onUpdateQuestion(gi, questionIndex, 'explanation', next))}
                            rows={1}
                            placeholder='Explanation'
                          />
                        </div>
                      )
                    ))
                  )}
                </div>
              ) : shouldUseSharedMultiChoiceEditor ? (
                <Card className='border-border/70 shadow-none'>
                  <CardHeader className='py-3'>
                    <div className='flex items-center justify-between'>
                      <Badge variant='outline'>
                        {group.questions.length > 1
                          ? `Q${group.questions[0]?.q_number ?? 1} - Q${group.questions[group.questions.length - 1]?.q_number ?? group.questions.length}`
                          : `Q${group.questions[0]?.q_number ?? 1}`}
                      </Badge>
                      <span className='text-xs text-muted-foreground'>Shared editor for multiple answers</span>
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    <div className='space-y-2'>
                      <Label>{canSyncPlaceholderQuestions ? 'Question Text (Shared)' : 'Question Text'}</Label>
                      <Textarea
                        value={sharedQuestion?.text || ''}
                        onChange={(event) => onSyncMultiChoiceSharedQuestion?.(gi, { text: event.target.value })}
                        onKeyDown={(event) => handleBoldShortcut(event, sharedQuestion?.text || '', (next) => onSyncMultiChoiceSharedQuestion?.(gi, { text: next }))}
                        rows={canSyncPlaceholderQuestions ? 1 : 2}
                        placeholder={canSyncPlaceholderQuestions ? 'Optional label for this placeholder question' : 'Question text...'}
                      />
                    </div>

                    <div className='space-y-2'>
                      <Label>Options</Label>
                      {sharedOptions.map((option, optionIndex) => {
                        const optionId = normalizeOptionToken(option?.label || option?.id || String.fromCharCode(65 + optionIndex));
                        const isSelected = sharedSelectedOptionIds.includes(optionId);
                        const limitReached = !isSelected && sharedSelectedOptionIds.length >= requiredSelectionCount;
                        return (
                          <div
                            key={`shared-${gi}-option-${optionIndex}`}
                            className={`flex items-center gap-2 rounded-md border p-2 ${isSelected ? 'border-primary/60 bg-primary/5' : 'border-border/60'}`}
                          >
                            <Button
                              type='button'
                              size='sm'
                              variant={isSelected ? 'default' : 'outline'}
                              className='h-8 min-w-8 px-2 font-semibold'
                              onClick={() => {
                                if (typeof onSetMultiChoiceCorrectAnswers !== 'function') return;
                                if (isSelected) {
                                  onSetMultiChoiceCorrectAnswers(gi, sharedSelectedOptionIds.filter((id) => id !== optionId));
                                  return;
                                }
                                if (limitReached) return;
                                onSetMultiChoiceCorrectAnswers(gi, [...sharedSelectedOptionIds, optionId]);
                              }}
                            >
                              {optionId || String.fromCharCode(65 + optionIndex)}
                            </Button>
                            <Input
                              value={option.text}
                              onChange={(event) => applySharedOptionsPatch((currentOptions) =>
                                currentOptions.map((currentOption, currentIndex) =>
                                  currentIndex === optionIndex
                                    ? { ...currentOption, text: event.target.value }
                                    : currentOption
                                )
                              )}
                              placeholder={`Option ${optionId || String.fromCharCode(65 + optionIndex)}`}
                            />
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              onClick={() => {
                                if (sharedOptions.length <= 1) return;
                                applySharedOptionsPatch((currentOptions) =>
                                  currentOptions.filter((_, currentIndex) => currentIndex !== optionIndex)
                                );
                              }}
                              className='text-destructive'
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </div>
                        );
                      })}
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => applySharedOptionsPatch(
                          (currentOptions) => [...currentOptions, { label: '', text: '' }],
                          { syncSelection: false }
                        )}
                      >
                        + Add Option
                      </Button>
                    </div>

                    <div className='space-y-2'>
                      <Label>Correct Answer(s)</Label>
                      <Input
                        value={sharedSelectedOptionIds.join(', ')}
                        readOnly
                        placeholder='Select by clicking option ID'
                      />
                      <p className='text-xs text-muted-foreground'>
                        Select exactly {requiredSelectionCount} option ID{requiredSelectionCount > 1 ? 's' : ''}.
                      </p>
                    </div>

                    <div className='space-y-2'>
                      <Label>Explanation</Label>
                      <Textarea
                        value={sharedQuestion?.explanation || ''}
                        onChange={(event) => onSyncMultiChoiceSharedQuestion?.(gi, { explanation: event.target.value })}
                        onKeyDown={(event) => handleBoldShortcut(event, sharedQuestion?.explanation || '', (next) => onSyncMultiChoiceSharedQuestion?.(gi, { explanation: next }))}
                        rows={2}
                        placeholder='Optional explanation'
                      />
                    </div>

                    {showPassageReferenceField ? (
                      <div className='space-y-2'>
                        <Label>Passage Reference</Label>
                        <Textarea
                          value={sharedQuestion?.passage_reference || ''}
                          onChange={(event) => onSyncMultiChoiceSharedQuestion?.(gi, { passage_reference: event.target.value })}
                          onKeyDown={(event) => handleBoldShortcut(event, sharedQuestion?.passage_reference || '', (next) => onSyncMultiChoiceSharedQuestion?.(gi, { passage_reference: next }))}
                          rows={2}
                          placeholder='Short quote/phrase that proves the answer'
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : (
                group.questions.map((question, questionIndex) => {
                  const questionCollapseKey = `${gi}-${questionIndex}`;
                  const isQuestionCollapsed = collapsedQuestions.has(questionCollapseKey);
                  const questionOptions = (Array.isArray(question.option) && question.option.length ? question.option : DEFAULT_OPTIONS)
                    .map((option, optionIndex) => ({
                      ...option,
                      label: option?.label || option?.id || String.fromCharCode(65 + optionIndex),
                    }));
                  const selectedOptionIds = getQuestionOptionIds(question, questionOptions);

                  return (
                    <Card key={questionCollapseKey} className='border-border/70 shadow-none'>
                      <CardHeader className='cursor-pointer py-3' onClick={() => onToggleQuestionCollapse(gi, questionIndex)}>
                        <div className='flex items-center justify-between'>
                          <Badge variant='outline'>Q{question.q_number}</Badge>
                          <div className='flex items-center gap-1' onClick={(event) => event.stopPropagation()}>
                            <Button type='button' size='sm' variant='ghost' onClick={() => onRemoveQuestion(gi, questionIndex)} className='text-destructive'>
                              <Trash2 className='h-4 w-4' />
                            </Button>
                            {isQuestionCollapsed ? <ChevronDown className='h-4 w-4' /> : <ChevronUp className='h-4 w-4' />}
                          </div>
                        </div>
                      </CardHeader>

                      {!isQuestionCollapsed ? (
                        <CardContent className='space-y-3'>
                          <div className='space-y-2'>
                            <Label>{canSyncPlaceholderQuestions ? 'Question Text (Optional)' : 'Question Text'}</Label>
                            <Textarea
                              value={question.text || ''}
                              onChange={(event) => onUpdateQuestion(gi, questionIndex, 'text', event.target.value)}
                              onKeyDown={(event) => handleBoldShortcut(event, question.text || '', (next) => onUpdateQuestion(gi, questionIndex, 'text', next))}
                              rows={canSyncPlaceholderQuestions ? 1 : 2}
                              placeholder={canSyncPlaceholderQuestions ? 'Optional label for this placeholder question' : 'Question text...'}
                            />
                          </div>

                          {group.type === 'mult_choice' ? (
                            <div className='space-y-2'>
                              <Label>Options</Label>
                              {questionOptions.map((option, optionIndex) => {
                                const optionId = normalizeOptionToken(option.label || option.id || String.fromCharCode(65 + optionIndex));
                                const isSelected = selectedOptionIds.includes(optionId);
                                return (
                                  <div
                                    key={`${questionCollapseKey}-option-${optionIndex}`}
                                    className={`flex items-center gap-2 rounded-md border p-2 ${isSelected ? 'border-primary/60 bg-primary/5' : 'border-border/60'}`}
                                  >
                                    <Button
                                      type='button'
                                      size='sm'
                                      variant={isSelected ? 'default' : 'outline'}
                                      className='h-8 min-w-8 px-2 font-semibold'
                                      onClick={() => onSetCorrectAnswers(gi, questionIndex, optionId)}
                                    >
                                      {optionId || String.fromCharCode(65 + optionIndex)}
                                    </Button>
                                    <Input
                                      value={option.text}
                                      onChange={(event) => onSetQuestionOption(gi, questionIndex, optionIndex, event.target.value)}
                                      placeholder={`Option ${optionId || String.fromCharCode(65 + optionIndex)}`}
                                    />
                                    <Button type='button' variant='ghost' size='icon' onClick={() => onRemoveQuestionOption(gi, questionIndex, optionIndex)} className='text-destructive'>
                                      <Trash2 className='h-4 w-4' />
                                    </Button>
                                  </div>
                                )
                              })}
                              <Button type='button' size='sm' variant='outline' onClick={() => onAddQuestionOption(gi, questionIndex)}>+ Add Option</Button>
                            </div>
                          ) : null}

                          <div className='space-y-2'>
                            <Label>Correct Answer(s)</Label>
                            <Input
                              value={group.type === 'mult_choice' ? selectedOptionIds.join(', ') : (typeof question.correct_answers_raw === 'string' ? question.correct_answers_raw : (question.correct_answers || []).join(', '))}
                              onChange={group.type === 'mult_choice' ? undefined : (event) => onSetCorrectAnswers(gi, questionIndex, event.target.value)}
                              readOnly={group.type === 'mult_choice'}
                              placeholder={
                                group.type === 'true_false_notgiven'
                                  ? 'TRUE / FALSE / NOT GIVEN'
                                  : group.type === 'yes_no_notgiven'
                                    ? 'YES / NO / NOT GIVEN'
                                    : (isMultipleChoiceType && isMultiChoiceMode)
                                      ? 'e.g. A, C'
                                      : group.type === 'mult_choice'
                                        ? 'Select by clicking option ID'
                                        : 'Comma-separated answers'
                              }
                            />
                            {isBooleanType ? (
                              <div className='flex flex-wrap items-center gap-2'>
                                {booleanAnswerPresets.map((value) => (
                                  <Button key={`${questionCollapseKey}-preset-${value}`} type='button' size='sm' variant='outline' onClick={() => onSetCorrectAnswers(gi, questionIndex, value)}>
                                    {value}
                                  </Button>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <div className='space-y-2'>
                            <Label>Explanation</Label>
                            <Textarea
                              value={question.explanation || ''}
                              onChange={(event) => onUpdateQuestion(gi, questionIndex, 'explanation', event.target.value)}
                              onKeyDown={(event) => handleBoldShortcut(event, question.explanation || '', (next) => onUpdateQuestion(gi, questionIndex, 'explanation', next))}
                              rows={2}
                              placeholder='Optional explanation'
                            />
                          </div>

                          {showPassageReferenceField ? (
                            <div className='space-y-2'>
                              <Label>Passage Reference</Label>
                              <Textarea
                                value={question.passage_reference || ''}
                                onChange={(event) => onUpdateQuestion(gi, questionIndex, 'passage_reference', event.target.value)}
                                onKeyDown={(event) => handleBoldShortcut(event, question.passage_reference || '', (next) => onUpdateQuestion(gi, questionIndex, 'passage_reference', next))}
                                rows={2}
                                placeholder='Short quote/phrase that proves the answer'
                              />
                            </div>
                          ) : null}
                        </CardContent>
                      ) : null}
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </CardContent>
      ) : null}
    </Card>
  );
}
