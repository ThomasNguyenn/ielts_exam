export const QUESTION_GROUP_LAYOUTS = [
  "default",
  "two_column",
  "with_reference",
  // Legacy values kept for backward compatibility with existing data.
  "radio",
  "checkbox",
];

export const PASSAGE_QUESTION_TYPES = [
  "true_false_notgiven",
  "yes_no_notgiven",
  "mult_choice",
  "matching_headings",
  "matching_info",
  "matching_information",
  "matching_features",
  "matching_sentence_endings",
  "sentence_completion",
  "summary_completion",
  "note_completion",
  "table_completion",
  "flow_chart_completion",
  "diagram_label_completion",
  "short_answer",
  // Legacy type kept for existing content.
  "gap_fill",
];

export const SECTION_QUESTION_TYPES = [
  "mult_choice",
  "form_completion",
  "note_completion",
  "table_completion",
  "flow_chart_completion",
  "sentence_completion",
  "short_answer",
  "matching",
  "plan_map_diagram",
  "listening_map",
  // Keep compatibility with old/parsed content.
  "true_false_notgiven",
  "yes_no_notgiven",
  "matching_headings",
  "matching_features",
  "matching_info",
  "matching_information",
  "summary_completion",
  "gap_fill",
];
