/** IELTS Writing Task 1 variants (graphs, charts, diagrams) */
export const WRITING_TASK_TYPES_TASK1 = [
  { value: 'bar_chart', label: 'Bar Chart' },
  { value: 'line_chart', label: 'Line Chart' },
  { value: 'pie_chart', label: 'Pie Chart' },
  { value: 'table', label: 'Table' },
  { value: 'map', label: 'Map' },
  { value: 'diagram', label: 'Diagram' },
  { value: 'process', label: 'Process' },
];

/** IELTS Writing Task 2 variants (essay types) */
export const WRITING_TASK_TYPES_TASK2 = [
  { value: 'agree_disagree', label: 'Agree or Disagree' },
  { value: 'discuss_both_views', label: 'Discuss Both Views' },
  { value: 'advantages_disadvantages', label: 'Advantages/Disadvantages' },
  { value: 'solutions', label: 'Solutions' },
  { value: 'direct_question', label: 'Direct Question' },
  { value: 'two_part_question', label: 'Two-part Question' },
];

/** Generic/Other for backward compatibility */
export const WRITING_TASK_TYPE_OTHER = { value: 'other', label: 'Other' };

/** All writing task types combined */
export const WRITING_TASK_TYPES = [
  ...WRITING_TASK_TYPES_TASK1,
  ...WRITING_TASK_TYPES_TASK2,
  WRITING_TASK_TYPE_OTHER,
];

/** Enum values for Mongoose schema */
export const WRITING_TASK_TYPE_VALUES = WRITING_TASK_TYPES.map((t) => t.value);

/**
 * Get display label for a writing task type value
 * @param {string} value - The enum value (e.g. 'bar_chart', 'agree_disagree')
 * @returns {string} Display label or the value if not found
 */
export function getWritingTaskTypeLabel(value) {
  if (!value) return '';
  const found = WRITING_TASK_TYPES.find((t) => t.value === value);
  return found ? found.label : value;
}
