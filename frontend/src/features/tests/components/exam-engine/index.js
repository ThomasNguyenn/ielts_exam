export { default as ExamEngine } from './Exam';
export { default as MultipleChoice } from './components/MultipleChoice';
export { default as TeacherTableBuilder } from './components/TeacherTableBuilder';
export { checkAnswer, EXAMPLE_GLOBAL_ANSWER_STATE } from './utils/answerCheck';
export { extractPlaceholderIds, splitByPlaceholders } from './utils/gapFillParser';
export { CORE_TYPES, normalizeGroupType } from './utils/normalizeType';
export { adaptLegacyExamToCoreSchema } from './utils/adapters';
export { EXAM_SCHEMA_EXAMPLE, CORE_TYPE_EXAMPLES } from './schemas/examSchemaExamples';
