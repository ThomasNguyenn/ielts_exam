const CANONICAL_MAP = {
  tfng: 'tfng',
  true_false_notgiven: 'tfng',
  true_false_not_given: 'tfng',
  ynng: 'ynng',
  yes_no_notgiven: 'ynng',
  yes_no_not_given: 'ynng',
  mult_choice: 'multiple_choice',
  multiple_choice_single: 'multiple_choice',
  multiple_choice_multi: 'multiple_choice',
  mult_choice_multi: 'multiple_choice',
  matching_info: 'matching_information',
};

const LABEL_MAP = {
  tfng: 'True / False / Not Given',
  ynng: 'Yes / No / Not Given',
  multiple_choice: 'Multiple Choice',
  matching_information: 'Matching Information',
  matching_headings: 'Matching Headings',
  matching_features: 'Matching Features',
  matching_sentence_endings: 'Matching Sentence Endings',
  summary_completion: 'Summary Completion',
  note_completion: 'Note Completion',
  table_completion: 'Table Completion',
  flow_chart_completion: 'Flow Chart Completion',
  sentence_completion: 'Sentence Completion',
  diagram_label_completion: 'Diagram Label Completion',
  form_completion: 'Form Completion',
  short_answer: 'Short Answer',
  plan_map_diagram: 'Plan / Map / Diagram Labeling',
  listening_map: 'Listening Map Labeling',
};

const toTitleCase = (value = '') =>
  String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const canonicalizeQuestionGroupType = (rawType = '') => {
  const normalized = String(rawType || '').trim().toLowerCase();
  if (!normalized) return '';
  return CANONICAL_MAP[normalized] || normalized;
};

export const getQuestionGroupLabel = (rawType = '') => {
  const canonical = canonicalizeQuestionGroupType(rawType);
  if (!canonical) return 'Unknown';
  return LABEL_MAP[canonical] || toTitleCase(canonical);
};
