# IELTS Exam Engine (Core Types)

This module provides a flexible rendering engine where teachers only input:

- question text
- correct answers
- passage text (if needed)
- options only for Multiple Choice

UI logic is handled by renderer components.

## Files generated

1. JSON schema examples for all core types:
`schemas/examSchemaExamples.js`
2. Master renderer:
`Exam.jsx`
3. Full table completion renderer:
`components/TableCompletionGroup.jsx`
4. Full diagram label renderer:
`components/DiagramLabelGroup.jsx`
5. Gap-fill parser utility:
`utils/gapFillParser.js`
6. Teacher table builder example:
`components/TeacherTableBuilder.jsx`
7. Example global answer state:
`utils/answerCheck.js` (`EXAMPLE_GLOBAL_ANSWER_STATE`)
8. Universal answer checking utility:
`utils/answerCheck.js` (`checkAnswer`)

## Core types

- `TFNG`
- `YNNG`
- `MULTIPLE_CHOICE_SINGLE`
- `MULTIPLE_CHOICE_MULTI`
- `MATCHING`
- `GAP_FILL`
- `TABLE_COMPLETION`
- `DIAGRAM_LABEL`

## Quick usage

```jsx
import Exam from '@/features/tests/components/exam-engine/Exam';
import { EXAM_SCHEMA_EXAMPLE } from '@/features/tests/components/exam-engine/schemas/examSchemaExamples';

export default function Demo() {
  return (
    <Exam
      exam={EXAM_SCHEMA_EXAMPLE}
      onSubmit={(answers) => {
        console.log('submit answers', answers);
      }}
    />
  );
}
```

## Multiple Choice architecture

Single reusable component:
`components/MultipleChoice.jsx`

Used by `Exam.jsx`:
- `MULTIPLE_CHOICE_SINGLE` -> `<MultipleChoice mode="single" />`
- `MULTIPLE_CHOICE_MULTI` -> `<MultipleChoice mode="multi" />`

Central answer state example:

```js
const [answers, setAnswers] = useState({
  1: 'B',
  2: ['A', 'C'],
});
```

Functional update pattern:

```js
const setAnswer = useCallback((id, valueOrUpdater) => {
  const normalizedId = String(id);
  setAnswers((prev) => {
    const previousValue = prev[normalizedId];
    const nextValue = typeof valueOrUpdater === 'function'
      ? valueOrUpdater(previousValue, prev)
      : valueOrUpdater;
    return { ...prev, [normalizedId]: nextValue };
  });
}, []);
```

Answer checking utility:
`utils/answerCheck.js` (`checkAnswer`)
