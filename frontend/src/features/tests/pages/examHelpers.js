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
  for (const b of typeBands) {
    if (correctCount >= b.min) {
      return b.band;
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
        for (const q of group.questions || []) {
          slots.push({
            type: group.type,
            instructions: group.instructions,
            headings: group.headings || [],
            options: group.options || [],
            q_number: q.q_number,
            text: q.text,
            option: q.option || [],
            correct_answer: q.correct_answer,
          });
        }
      }
    }
  };
  pushSlots(exam.reading);
  pushSlots(exam.listening);
  return slots;
}

/** Build steps: one per passage/section/writing-task with slot range */
export function buildSteps(exam) {
  const steps = [];
  let slotIndex = 0;
  const pushStep = (type, label, item) => {
    let start = slotIndex;
    if (type === "reading" || type === "listening") {
      for (const group of item.question_groups || []) {
        slotIndex += (group.questions || []).length;
      }
    } else if (type === "writing") {
      // Writing tasks don't have slot indices
      start = -1;
    }
    steps.push({ type, label, item, startSlotIndex: start, endSlotIndex: slotIndex });
  };
  (exam.reading || []).forEach((p, i) => pushStep("reading", `Passage ${i + 1}`, p));
  (exam.listening || []).forEach((s, i) => pushStep("listening", `Section ${i + 1}`, s));
  (exam.writing || []).forEach((w, i) => pushStep("writing", `Task ${i + 1}`, w));
  return steps;
}
