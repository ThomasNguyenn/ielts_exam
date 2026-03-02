import { useCallback, useEffect, useMemo, useState } from 'react';
import TrueFalseGroup from './components/TrueFalseGroup';
import MultipleChoice from './components/MultipleChoice';
import MatchingGroup from './components/MatchingGroup';
import MatchingInformationTableGroup from './components/MatchingInformationTableGroup';
import GapFillGroup from './components/GapFillGroup';
import TableCompletionGroup from './components/TableCompletionGroup';
import DiagramLabelGroup from './components/DiagramLabelGroup';
import { extractPlaceholderIds } from './utils/gapFillParser';
import { CORE_TYPES, normalizeGroupType } from './utils/normalizeType';
import './ExamEngine.css';

function getQuestionId(question, index) {
  return String(question?.id ?? question?.q_number ?? index + 1);
}

function getQuestionPrompt(question) {
  return question?.question || question?.text || '';
}

function toAnswerList(group) {
  if (Array.isArray(group?.answers)) {
    return group.answers.map((item) => ({
      id: String(item.id),
      correct_answer: item.correct_answer,
    }));
  }

  return (group?.questions || []).map((question, index) => ({
    id: getQuestionId(question, index),
    correct_answer: Array.isArray(question.correct_answers)
      ? (question.correct_answers.length > 1 ? question.correct_answers : question.correct_answers[0] || '')
      : (question.correct_answer || ''),
  }));
}

function normalizeMatchingGroup(group) {
  const left_items = Array.isArray(group.left_items)
    ? group.left_items.map((item, index) => ({
      id: String(item.id ?? index + 1),
      text: String(item.text || ''),
    }))
    : (group.questions || []).map((question, index) => ({
      id: getQuestionId(question, index),
      text: getQuestionPrompt(question),
    }));

  const right_options = Array.isArray(group.right_options) && group.right_options.length
    ? group.right_options
    : (group.headings || group.options || []).map((item) => (
      typeof item === 'string'
        ? item
        : `${item.id}. ${item.text}`
    ));

  return {
    ...group,
    left_items,
    right_options,
    answers: toAnswerList(group),
    use_once: Boolean(group.use_once),
  };
}

function normalizeGapFillGroup(group) {
  const answers = toAnswerList(group);
  const hasPassage = typeof group.passage === 'string' && group.passage.length > 0;
  const passage = hasPassage ? group.passage : (group.text || '');
  const usePassageMode = extractPlaceholderIds(passage).length > 0;

  if (usePassageMode) {
    return {
      ...group,
      passage,
      answers,
    };
  }

  return {
    ...group,
    questions: (group.questions || []).map((question, index) => ({
      id: getQuestionId(question, index),
      question: getQuestionPrompt(question),
      correct_answer: Array.isArray(question.correct_answers)
        ? (question.correct_answers.length > 1 ? question.correct_answers : question.correct_answers[0] || '')
        : (question.correct_answer || ''),
    })),
    answers,
  };
}

function normalizeTableGroup(group) {
  return {
    ...group,
    table: group.table || { rows: 0, columns: 0, cells: [] },
    answers: toAnswerList(group),
  };
}

function normalizeDiagramGroup(group) {
  const diagram_items = Array.isArray(group.diagram_items) && group.diagram_items.length > 0
    ? group.diagram_items.map((item, index) => ({
      id: String(item.id ?? index + 1),
      text: String(item.text || ''),
    }))
    : (group.questions || []).map((question, index) => ({
      id: getQuestionId(question, index),
      text: getQuestionPrompt(question),
    }));

  return {
    ...group,
    diagram_items,
    answers: toAnswerList(group),
  };
}

function normalizeChoiceQuestions(group) {
  return (group.questions || []).map((question, index) => {
    const options = Array.isArray(question.options) && question.options.length > 0
      ? question.options
      : (question.option || []);
    const requiredCount = Number(question.required_count)
      || Number(question.max_select)
      || Number(group.required_count)
      || Number(group.max_select)
      || null;

    return {
      id: getQuestionId(question, index),
      question: getQuestionPrompt(question),
      options,
      correct_answer: Array.isArray(question.correct_answers)
        ? (question.correct_answers.length > 1 ? question.correct_answers : question.correct_answers[0] || '')
        : (question.correct_answer || ''),
      required_count: requiredCount,
    };
  });
}

function normalizeBooleanQuestions(group) {
  return (group.questions || []).map((question, index) => ({
    id: getQuestionId(question, index),
    question: getQuestionPrompt(question),
    correct_answer: Array.isArray(question.correct_answers)
      ? (question.correct_answers[0] || '')
      : (question.correct_answer || ''),
  }));
}

function collectIdsFromGroup(group, coreType) {
  if (coreType === CORE_TYPES.TFNG || coreType === CORE_TYPES.YNNG) {
    return normalizeBooleanQuestions(group).map((question) => ({ id: question.id, isMulti: false }));
  }

  if (coreType === CORE_TYPES.MULTIPLE_CHOICE_SINGLE) {
    return normalizeChoiceQuestions(group).map((question) => ({ id: question.id, isMulti: false }));
  }

  if (coreType === CORE_TYPES.MULTIPLE_CHOICE_MULTI) {
    return normalizeChoiceQuestions(group).map((question) => ({ id: question.id, isMulti: true }));
  }

  if (coreType === CORE_TYPES.MATCHING) {
    return normalizeMatchingGroup(group).left_items.map((item) => ({ id: item.id, isMulti: false }));
  }

  if (coreType === CORE_TYPES.GAP_FILL) {
    const normalizedGroup = normalizeGapFillGroup(group);
    const passageIds = extractPlaceholderIds(normalizedGroup.passage || '').map((id) => ({ id, isMulti: false }));
    const questionIds = (normalizedGroup.questions || []).map((question) => ({ id: String(question.id), isMulti: false }));
    return passageIds.length > 0 ? passageIds : questionIds;
  }

  if (coreType === CORE_TYPES.TABLE_COMPLETION) {
    const table = normalizeTableGroup(group).table;
    const ids = new Set();
    (table.cells || []).forEach((cell) => {
      extractPlaceholderIds(String(cell.content || '')).forEach((id) => ids.add(id));
    });
    return Array.from(ids).map((id) => ({ id, isMulti: false }));
  }

  if (coreType === CORE_TYPES.DIAGRAM_LABEL) {
    const diagram = normalizeDiagramGroup(group).diagram_items;
    const ids = new Set();
    diagram.forEach((item) => {
      extractPlaceholderIds(String(item.text || '')).forEach((id) => ids.add(id));
    });
    return Array.from(ids).map((id) => ({ id, isMulti: false }));
  }

  return [];
}

function buildInitialAnswers(exam, initialAnswers = {}) {
  const next = { ...initialAnswers };
  const sections = Array.isArray(exam?.sections) ? exam.sections : [];

  sections.forEach((section) => {
    (section.question_groups || []).forEach((group) => {
      const coreType = normalizeGroupType(group);
      collectIdsFromGroup(group, coreType).forEach(({ id, isMulti }) => {
        if (Object.prototype.hasOwnProperty.call(next, id)) return;
        next[id] = isMulti ? [] : '';
      });
    });
  });

  return next;
}

export default function Exam({
  exam,
  initialAnswers = {},
  onAnswersChange,
  onSubmit,
  readOnly = false,
}) {
  const [answers, setAnswers] = useState(() => buildInitialAnswers(exam, initialAnswers));

  useEffect(() => {
    setAnswers(buildInitialAnswers(exam, initialAnswers));
  }, [exam, initialAnswers]);

  useEffect(() => {
    if (typeof onAnswersChange === 'function') {
      onAnswersChange(answers);
    }
  }, [answers, onAnswersChange]);

  const setAnswer = useCallback((id, valueOrUpdater) => {
    const normalizedId = String(id);
    setAnswers((prev) => {
      const previousValue = prev[normalizedId];
      const nextValue = typeof valueOrUpdater === 'function'
        ? valueOrUpdater(previousValue, prev)
        : valueOrUpdater;

      return {
        ...prev,
        [normalizedId]: nextValue,
      };
    });
  }, []);

  const sections = useMemo(() => Array.isArray(exam?.sections) ? exam.sections : [], [exam]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (typeof onSubmit === 'function') {
      onSubmit(answers);
    }
  };

  const renderGroup = (group) => {
    const coreType = normalizeGroupType(group);
    const rawType = String(group?.type || '').trim().toLowerCase();

    switch (coreType) {
      case CORE_TYPES.TFNG:
      case CORE_TYPES.YNNG:
        return (
          <TrueFalseGroup
            type={coreType}
            questions={normalizeBooleanQuestions(group)}
            answers={answers}
            setAnswer={setAnswer}
            readOnly={readOnly}
          />
        );

      case CORE_TYPES.MULTIPLE_CHOICE_SINGLE:
        return (
          <MultipleChoice
            mode="single"
            questions={normalizeChoiceQuestions(group)}
            answers={answers}
            setAnswer={setAnswer}
            readOnly={readOnly}
          />
        );

      case CORE_TYPES.MULTIPLE_CHOICE_MULTI:
        return (
          <MultipleChoice
            mode="multi"
            questions={normalizeChoiceQuestions(group)}
            answers={answers}
            setAnswer={setAnswer}
            readOnly={readOnly}
          />
        );

      case CORE_TYPES.MATCHING:
        if (rawType === 'matching_information' || rawType === 'matching_info') {
          return (
            <MatchingInformationTableGroup
              group={group}
              answers={answers}
              setAnswer={setAnswer}
              readOnly={readOnly}
            />
          );
        }

        return (
          <MatchingGroup
            group={normalizeMatchingGroup(group)}
            answers={answers}
            setAnswer={setAnswer}
            readOnly={readOnly}
          />
        );

      case CORE_TYPES.GAP_FILL:
        return (
          <GapFillGroup
            group={normalizeGapFillGroup(group)}
            answers={answers}
            setAnswer={setAnswer}
            readOnly={readOnly}
          />
        );

      case CORE_TYPES.TABLE_COMPLETION:
        return (
          <TableCompletionGroup
            group={normalizeTableGroup(group)}
            answers={answers}
            setAnswer={setAnswer}
            readOnly={readOnly}
          />
        );

      case CORE_TYPES.DIAGRAM_LABEL:
        return (
          <DiagramLabelGroup
            group={normalizeDiagramGroup(group)}
            answers={answers}
            setAnswer={setAnswer}
            readOnly={readOnly}
          />
        );

      default:
        return (
          <div className="engine-unsupported">
            Unsupported group type: <code>{String(group.type)}</code>
          </div>
        );
    }
  };

  return (
    <form className="exam-engine" onSubmit={handleSubmit}>
      <header className="exam-engine-header">
        <h2>{exam?.module || 'EXAM'}</h2>
      </header>

      {sections.map((section) => (
        <section key={section.section_number} className="exam-engine-section">
          <h3>Section {section.section_number}</h3>

          {section.passage && (
            <article className="exam-engine-passage">
              <p>{section.passage}</p>
            </article>
          )}

          {section.audio_url && (
            <div className="exam-engine-audio">
              <audio controls src={section.audio_url}>
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {(section.question_groups || []).map((group, index) => (
            <div key={`${section.section_number}-${index}`} className="exam-engine-group-card">
              <div className="exam-engine-group-title">
                <strong>Group {index + 1}</strong>
                <span>{normalizeGroupType(group)}</span>
              </div>
              {renderGroup(group, index)}
            </div>
          ))}
        </section>
      ))}

      <footer className="exam-engine-footer">
        <button type="submit" disabled={readOnly}>
          Submit Answers
        </button>
      </footer>
    </form>
  );
}
