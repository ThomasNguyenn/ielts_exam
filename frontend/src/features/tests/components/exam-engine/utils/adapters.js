import { normalizeGroupType } from './normalizeType';

function toCoreQuestion(question = {}, index = 0) {
  return {
    id: question.id ?? question.q_number ?? index + 1,
    question: question.question || question.text || '',
    options: question.options || question.option || [],
    correct_answer: Array.isArray(question.correct_answers)
      ? (question.correct_answers.length > 1 ? question.correct_answers : question.correct_answers[0] || '')
      : (question.correct_answer || ''),
  };
}

function toCoreGroup(group = {}) {
  const coreType = normalizeGroupType(group);
  return {
    type: coreType,
    use_once: Boolean(group.use_once),
    passage: group.passage || group.text || '',
    table: group.table,
    diagram_items: group.diagram_items,
    left_items: group.left_items,
    right_options: group.right_options,
    headings: group.headings,
    options: group.options,
    answers: group.answers,
    questions: (group.questions || []).map(toCoreQuestion),
  };
}

export function adaptLegacyExamToCoreSchema(legacyExam = {}) {
  const sections = [];
  let sectionNumber = 1;

  (legacyExam.reading || []).forEach((item) => {
    sections.push({
      section_number: sectionNumber,
      passage: item.content || '',
      question_groups: (item.question_groups || []).map(toCoreGroup),
    });
    sectionNumber += 1;
  });

  (legacyExam.listening || []).forEach((item) => {
    sections.push({
      section_number: sectionNumber,
      passage: item.content || '',
      audio_url: item.audio_url || '',
      question_groups: (item.question_groups || []).map(toCoreGroup),
    });
    sectionNumber += 1;
  });

  return {
    module: String(legacyExam.type || 'READING').toUpperCase(),
    sections,
  };
}
