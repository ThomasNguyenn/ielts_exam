export const CORE_TYPE_EXAMPLES = {
  TFNG: {
    type: 'TFNG',
    questions: [
      { id: 1, question: 'The company opened in 1990.', correct_answer: 'TRUE' },
      { id: 2, question: 'The factory employs 900 workers.', correct_answer: 'FALSE' },
      { id: 3, question: 'The factory exports to Europe.', correct_answer: 'NOT GIVEN' },
    ],
  },

  YNNG: {
    type: 'YNNG',
    questions: [
      { id: 4, question: 'The writer supports this policy.', correct_answer: 'YES' },
      { id: 5, question: 'The writer rejects all alternatives.', correct_answer: 'NO' },
      { id: 6, question: 'The writer previously worked in banking.', correct_answer: 'NOT GIVEN' },
    ],
  },

  MULTIPLE_CHOICE_SINGLE: {
    type: 'MULTIPLE_CHOICE_SINGLE',
    questions: [
      {
        id: 7,
        question: 'Why did the city council reject the proposal?',
        options: ['A. Cost was too high', 'B. Public support was low', 'C. Timeline was unrealistic'],
        correct_answer: 'B',
      },
    ],
  },

  MULTIPLE_CHOICE_MULTI: {
    type: 'MULTIPLE_CHOICE_MULTI',
    questions: [
      {
        id: 8,
        question: 'Which TWO reasons were mentioned?',
        options: ['A. Price increase', 'B. Staff shortage', 'C. Weather delays', 'D. New regulations'],
        correct_answer: ['A', 'D'],
      },
    ],
  },

  MATCHING: {
    type: 'MATCHING',
    use_once: true,
    left_items: [
      { id: 9, text: 'Paragraph A' },
      { id: 10, text: 'Paragraph B' },
      { id: 11, text: 'Paragraph C' },
    ],
    right_options: ['i. Historical context', 'ii. Technical details', 'iii. Future predictions'],
    answers: [
      { id: 9, correct_answer: 'ii' },
      { id: 10, correct_answer: 'i' },
      { id: 11, correct_answer: 'iii' },
    ],
  },

  GAP_FILL: {
    type: 'GAP_FILL',
    passage: 'The factory was built in [12] and employs [13] workers.',
    answers: [
      { id: 12, correct_answer: '1990' },
      { id: 13, correct_answer: '300' },
    ],
  },

  TABLE_COMPLETION: {
    type: 'TABLE_COMPLETION',
    table: {
      rows: 3,
      columns: 2,
      cells: [
        { row: 0, col: 0, content: 'Name' },
        { row: 0, col: 1, content: 'Age' },
        { row: 1, col: 0, content: 'John' },
        { row: 1, col: 1, content: '[14]' },
        { row: 2, col: 0, content: 'Mary' },
        { row: 2, col: 1, content: '[15]' },
      ],
    },
    answers: [
      { id: 14, correct_answer: '25' },
      { id: 15, correct_answer: '31' },
    ],
  },

  DIAGRAM_LABEL: {
    type: 'DIAGRAM_LABEL',
    diagram_items: [
      { id: 16, text: 'Water enters through [16].' },
      { id: 17, text: 'The filter removes [17].' },
      { id: 18, text: 'Clean water exits from [18].' },
    ],
    answers: [
      { id: 16, correct_answer: 'pipe' },
      { id: 17, correct_answer: 'impurities' },
      { id: 18, correct_answer: 'outlet valve' },
    ],
  },
};

export const EXAM_SCHEMA_EXAMPLE = {
  module: 'READING',
  sections: [
    {
      section_number: 1,
      passage: 'Sample reading passage...',
      question_groups: [
        CORE_TYPE_EXAMPLES.TFNG,
        CORE_TYPE_EXAMPLES.MULTIPLE_CHOICE_SINGLE,
        CORE_TYPE_EXAMPLES.GAP_FILL,
      ],
    },
    {
      section_number: 2,
      audio_url: 'https://example.com/listening-section-2.mp3',
      question_groups: [
        CORE_TYPE_EXAMPLES.YNNG,
        CORE_TYPE_EXAMPLES.MATCHING,
        CORE_TYPE_EXAMPLES.TABLE_COMPLETION,
        CORE_TYPE_EXAMPLES.DIAGRAM_LABEL,
      ],
    },
  ],
};
