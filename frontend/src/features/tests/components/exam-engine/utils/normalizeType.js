export const CORE_TYPES = Object.freeze({
  TFNG: 'TFNG',
  YNNG: 'YNNG',
  MULTIPLE_CHOICE_SINGLE: 'MULTIPLE_CHOICE_SINGLE',
  MULTIPLE_CHOICE_MULTI: 'MULTIPLE_CHOICE_MULTI',
  MATCHING: 'MATCHING',
  GAP_FILL: 'GAP_FILL',
  TABLE_COMPLETION: 'TABLE_COMPLETION',
  DIAGRAM_LABEL: 'DIAGRAM_LABEL',
});

const DIRECT_MAP = {
  tfng: CORE_TYPES.TFNG,
  true_false_notgiven: CORE_TYPES.TFNG,
  ynng: CORE_TYPES.YNNG,
  yes_no_notgiven: CORE_TYPES.YNNG,
  multiple_choice_single: CORE_TYPES.MULTIPLE_CHOICE_SINGLE,
  multiple_choice_multi: CORE_TYPES.MULTIPLE_CHOICE_MULTI,
  mult_choice_multi: CORE_TYPES.MULTIPLE_CHOICE_MULTI,
  matching: CORE_TYPES.MATCHING,
  matching_headings: CORE_TYPES.MATCHING,
  matching_features: CORE_TYPES.MATCHING,
  matching_info: CORE_TYPES.MATCHING,
  matching_information: CORE_TYPES.MATCHING,
  matching_sentence_endings: CORE_TYPES.MATCHING,
  gap_fill: CORE_TYPES.GAP_FILL,
  sentence_completion: CORE_TYPES.GAP_FILL,
  summary_completion: CORE_TYPES.GAP_FILL,
  note_completion: CORE_TYPES.GAP_FILL,
  form_completion: CORE_TYPES.GAP_FILL,
  short_answer: CORE_TYPES.GAP_FILL,
  table_completion: CORE_TYPES.TABLE_COMPLETION,
  diagram_label: CORE_TYPES.DIAGRAM_LABEL,
  diagram_label_completion: CORE_TYPES.DIAGRAM_LABEL,
  flow_chart_completion: CORE_TYPES.DIAGRAM_LABEL,
  plan_map_diagram: CORE_TYPES.DIAGRAM_LABEL,
  listening_map: CORE_TYPES.DIAGRAM_LABEL,
};

export function normalizeGroupType(group = {}) {
  const rawType = String(group.type || '').trim().toLowerCase();

  if (rawType === 'mult_choice') {
    const hasManyQuestions = Array.isArray(group.questions) && group.questions.length > 1;
    const isMultiLayout = group.group_layout === 'checkbox' || group.group_layout === 'multi';
    return isMultiLayout || hasManyQuestions
      ? CORE_TYPES.MULTIPLE_CHOICE_MULTI
      : CORE_TYPES.MULTIPLE_CHOICE_SINGLE;
  }

  return DIRECT_MAP[rawType] || String(group.type || '').toUpperCase();
}
