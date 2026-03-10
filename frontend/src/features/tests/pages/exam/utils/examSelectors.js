/** IELTS Band Score Calculator */
export function calculateIELTSBand(correctCount, testType) {
  const bands = {
    listening: [
      { min: 39, band: 9.0 },
      { min: 37, band: 8.5 },
      { min: 35, band: 8.0 },
      { min: 32, band: 7.5 },
      { min: 30, band: 7.0 },
      { min: 26, band: 6.5 },
      { min: 23, band: 6.0 },
      { min: 18, band: 5.5 },
      { min: 16, band: 5.0 },
      { min: 13, band: 4.5 },
      { min: 10, band: 4.0 },
      { min: 8, band: 3.5 },
      { min: 6, band: 3.0 },
      { min: 4, band: 2.5 },
      { min: 2, band: 2.0 },
      { min: 1, band: 1.0 },
      { min: 0, band: 0 },
    ],
    reading: [
      { min: 39, band: 9.0 },
      { min: 37, band: 8.5 },
      { min: 35, band: 8.0 },
      { min: 33, band: 7.5 },
      { min: 30, band: 7.0 },
      { min: 27, band: 6.5 },
      { min: 23, band: 6.0 },
      { min: 19, band: 5.5 },
      { min: 15, band: 5.0 },
      { min: 13, band: 4.5 },
      { min: 10, band: 4.0 },
      { min: 8, band: 3.5 },
      { min: 6, band: 3.0 },
      { min: 4, band: 2.5 },
      { min: 2, band: 2.0 },
      { min: 1, band: 1.0 },
      { min: 0, band: 0 },
    ],
  };

  const typeBands = bands[testType] || bands.reading;
  for (const band of typeBands) {
    if (correctCount >= band.min) {
      return band.band;
    }
  }
  return 0;
}

/** Build flat list of question slots in exam order */
export function buildQuestionSlots(exam) {
  const slots = [];
  const pushSlots = (items) => {
    if (!items) return;
    for (const item of items) {
      for (const group of item.question_groups || []) {
        for (const question of group.questions || []) {
          slots.push({
            type: group.type,
            instructions: group.instructions,
            headings: group.headings || [],
            options: group.options || [],
            q_number: question.q_number,
            text: question.text,
            option: question.option || [],
            correct_answer: question.correct_answer,
          });
        }
      }
    }
  };

  pushSlots(exam?.reading);
  pushSlots(exam?.listening);
  return slots;
}

/** Build steps: one per passage/section/writing-task with slot range */
export function buildSteps(exam) {
  const steps = [];
  let slotIndex = 0;

  const pushStep = (type, label, item) => {
    let start = slotIndex;
    if (type === 'reading' || type === 'listening') {
      for (const group of item.question_groups || []) {
        slotIndex += (group.questions || []).length;
      }
    } else if (type === 'writing') {
      start = -1;
    }
    steps.push({ type, label, item, startSlotIndex: start, endSlotIndex: slotIndex });
  };

  (exam?.reading || []).forEach((passage, index) => pushStep('reading', `Passage ${index + 1}`, passage));
  (exam?.listening || []).forEach((section, index) => pushStep('listening', `Section ${index + 1}`, section));
  (exam?.writing || []).forEach((writingTask, index) => pushStep('writing', `Task ${index + 1}`, writingTask));

  return steps;
}

export const getListeningAudioQueue = ({ exam, isSingleMode }) => {
  if (!exam || exam.type !== 'listening' || isSingleMode) return [];
  if (exam.full_audio) return [exam.full_audio];
  return (exam.listening || []).map((section) => section.audio_url).filter(Boolean);
};

export const getWritingStepIndices = (steps = []) =>
  steps.reduce((indices, stepItem, stepIndex) => {
    if (stepItem?.type === 'writing') {
      indices.push(stepIndex);
    }
    return indices;
  }, []);

export const getCurrentWritingTaskIndex = ({ writingStepIndices, currentStep }) =>
  writingStepIndices.indexOf(currentStep);

export const getStepQuestionIndices = ({ step, isWriting }) => {
  if (!step || isWriting) return [];
  const safeStart = Math.max(0, Number(step.startSlotIndex) || 0);
  const safeEnd = Math.max(safeStart, Number(step.endSlotIndex) || safeStart);
  return Array.from({ length: safeEnd - safeStart }, (_, offset) => safeStart + offset);
};

export const getCurrentStepAnswered = ({
  isWriting,
  currentWritingTaskIndex,
  writingAnswers,
  stepQuestionIndices,
  answers,
}) => {
  if (isWriting) {
    if (currentWritingTaskIndex < 0) return 0;
    return String(writingAnswers[currentWritingTaskIndex] || '').trim() ? 1 : 0;
  }

  return stepQuestionIndices.reduce(
    (count, questionIndex) => count + (String(answers[questionIndex] || '').trim() ? 1 : 0),
    0,
  );
};

export const getQuestionRangeLabel = ({
  step,
  isWriting,
  currentWritingTaskIndex,
  writingStepCount,
  stepQuestionIndices,
  slots,
}) => {
  if (!step) return 'No range';

  if (isWriting) {
    if (currentWritingTaskIndex >= 0) {
      return `Task ${currentWritingTaskIndex + 1} / ${Math.max(1, writingStepCount)}`;
    }
    return step.label || 'Writing task';
  }

  if (!stepQuestionIndices.length) return 'No questions';
  const firstIndex = stepQuestionIndices[0];
  const lastIndex = stepQuestionIndices[stepQuestionIndices.length - 1];
  const firstQuestion = slots[firstIndex]?.q_number ?? firstIndex + 1;
  const lastQuestion = slots[lastIndex]?.q_number ?? lastIndex + 1;
  return `Questions ${firstQuestion} - ${lastQuestion}`;
};

export const getFooterNavigationItems = ({
  step,
  isWriting,
  writingStepIndices,
  writingAnswers,
  currentStep,
  stepQuestionIndices,
  slots,
  answers,
}) => {
  if (!step) return [];

  if (isWriting) {
    return writingStepIndices.map((stepIndex, index) => ({
      key: `task-${index}`,
      label: index + 1,
      answered: String(writingAnswers[index] || '').trim().length > 0,
      active: stepIndex === currentStep,
      stepIndex,
      ariaLabel: `Task ${index + 1}`,
    }));
  }

  return stepQuestionIndices.map((questionIndex) => ({
    key: `question-${questionIndex}`,
    label: slots[questionIndex]?.q_number ?? questionIndex + 1,
    answered: String(answers[questionIndex] || '').trim().length > 0,
    active: false,
    questionIndex,
    ariaLabel: `Question ${slots[questionIndex]?.q_number ?? questionIndex + 1}`,
  }));
};

export const getCurrentStepTotal = ({ isWriting, stepQuestionIndices }) =>
  (isWriting ? 1 : stepQuestionIndices.length);
