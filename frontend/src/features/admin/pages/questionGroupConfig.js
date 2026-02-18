export const GROUP_LAYOUT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'two_column', label: 'Two Column' },
  { value: 'with_reference', label: 'With Reference Text' },
  { value: 'radio', label: 'Single Choice (Legacy)' },
  { value: 'checkbox', label: 'Multi Choice (Legacy)' },
];

export const PASSAGE_QUESTION_TYPE_OPTIONS = [
  { value: 'true_false_notgiven', label: 'True / False / Not Given' },
  { value: 'yes_no_notgiven', label: 'Yes / No / Not Given' },
  { value: 'mult_choice', label: 'Multiple Choice' },
  { value: 'matching_headings', label: 'Matching Headings' },
  { value: 'matching_information', label: 'Matching Information' },
  { value: 'matching_features', label: 'Matching Features' },
  { value: 'matching_sentence_endings', label: 'Matching Sentence Endings' },
  { value: 'sentence_completion', label: 'Sentence Completion' },
  { value: 'summary_completion', label: 'Summary Completion' },
  { value: 'note_completion', label: 'Note Completion' },
  { value: 'table_completion', label: 'Table Completion' },
  { value: 'flow_chart_completion', label: 'Flow-chart Completion' },
  { value: 'diagram_label_completion', label: 'Diagram Label Completion' },
  { value: 'short_answer', label: 'Short-answer Questions' },
];

export const SECTION_QUESTION_TYPE_OPTIONS = [
  { value: 'mult_choice', label: 'Multiple Choice' },
  { value: 'form_completion', label: 'Form Completion' },
  { value: 'note_completion', label: 'Note Completion' },
  { value: 'table_completion', label: 'Table Completion' },
  { value: 'flow_chart_completion', label: 'Flow-chart Completion' },
  { value: 'sentence_completion', label: 'Sentence Completion' },
  { value: 'short_answer', label: 'Short-answer Questions' },
  { value: 'matching', label: 'Matching' },
  { value: 'plan_map_diagram', label: 'Plan / Map / Diagram Labelling' },
  { value: 'listening_map', label: 'Listening Map' },
  { value: 'true_false_notgiven', label: 'True / False / Not Given' },
  { value: 'yes_no_notgiven', label: 'Yes / No / Not Given' },
  { value: 'matching_headings', label: 'Matching Headings' },
  { value: 'matching_features', label: 'Matching Features' },
  { value: 'matching_information', label: 'Matching Information' },
  { value: 'summary_completion', label: 'Summary Completion' },
];

export const MATCHING_GROUP_TYPES = new Set([
  'matching_headings',
  'matching_features',
  'matching_info',
  'matching_information',
  'matching_sentence_endings',
  'matching',
]);

export const GROUP_OPTION_TYPES = new Set([
  'summary_completion',
  'note_completion',
  'table_completion',
  'flow_chart_completion',
  'diagram_label_completion',
  'form_completion',
  'plan_map_diagram',
  'listening_map',
  'matching_sentence_endings',
  'matching',
]);

export const REFERENCE_TEXT_TYPES = new Set([
  'summary_completion',
  'note_completion',
  'table_completion',
  'flow_chart_completion',
  'diagram_label_completion',
  'sentence_completion',
  'form_completion',
  'plan_map_diagram',
  'listening_map',
  'gap_fill',
]);

export const BOOLEAN_GROUP_TYPES = new Set([
  'true_false_notgiven',
  'yes_no_notgiven',
]);

export const PLACEHOLDER_SYNC_TYPES = new Set([
  'matching_headings',
  'summary_completion',
  'note_completion',
  'table_completion',
  'flow_chart_completion',
  'diagram_label_completion',
  'sentence_completion',
  'form_completion',
  'plan_map_diagram',
  'listening_map',
  'gap_fill',
]);

export const COMPLETION_ANSWER_LIST_TYPES = new Set([
  'summary_completion',
  'note_completion',
  'table_completion',
  'flow_chart_completion',
  'diagram_label_completion',
  'sentence_completion',
  'form_completion',
  'gap_fill',
]);

export const ANSWER_LIST_ONLY_TYPES = new Set([
  ...COMPLETION_ANSWER_LIST_TYPES,
  'matching_headings',
]);

export const PLACEHOLDER_FROM_PASSAGE_CONTENT_TYPES = new Set([
  'matching_headings',
]);
