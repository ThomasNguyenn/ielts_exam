# Frontend Structure Playbook (React Complex Components)

## 1) Target Architecture
Use domain responsibility splits, not "split for shorter file":

- `pages/<feature>/Page.jsx`: orchestration only (route, mode switch, wiring)
- `pages/<feature>/hooks/*`: business domains (loader, session, timer, draft, tracking, submit)
- `pages/<feature>/components/*`: presentational shells for page-specific UI
- `pages/<feature>/utils/*`: pure derivation/mapping/storage helpers
- `pages/<feature>/constants/*`: thresholds, timing, storage versions
- `pages/<feature>/types/*`: JSDoc contracts for state/payloads

Applied for exam flow:

- `frontend/src/features/tests/pages/exam/ExamPage.jsx`
- `frontend/src/features/tests/pages/exam/hooks/*`
- `frontend/src/features/tests/pages/exam/components/*`
- `frontend/src/features/tests/pages/exam/utils/*`
- `frontend/src/features/tests/pages/exam/constants/examConstants.js`
- `frontend/src/features/tests/pages/exam/types/exam.types.js`

Compatibility entrypoints kept:

- `frontend/src/features/tests/pages/Exam.jsx` (thin wrapper)
- `frontend/src/features/tests/pages/examHelpers.js` (facade re-export)

## 2) Hook Contracts
### `useExamLoader(examId)`
Returns:

- `{ exam, loading, error, reload }`

Responsibilities:

- fetch exam
- abort stale requests
- isolate server state load from local attempt state

### `useExamSession()`
State domain:

- `answers`, `writingAnswers`, `currentStep`, `passageStates`
- `submitted`, `mode`
- modal flags: `showSubmitConfirm`, `showScoreChoice`
- `startTime`

Key APIs:

- `resetAttempt`
- `hydrateFromDraft` (`HYDRATE_FROM_DRAFT`)
- `setAnswer`, `setWritingAnswer`, `setCurrentStep`, `setPassageState`
- `openSubmitConfirm`, `closeSubmitConfirm`
- `openScoreChoice`, `closeScoreChoice`
- `setSubmitted`, `enterReviewMode`, `exitReviewMode`, `setStartTime`

### `useExamTimer({ durationSec, enabled, onExpire })`
Returns:

- `timeRemaining`
- `warningLevel: 'normal' | '10min' | '5min' | 'expired'`
- `setTimeRemaining`, `resetTimer`, `pauseTimer`, `startTimer`, `expire`

### `useListeningController(...)`
Returns:

- `listeningAudioQueue`, `listeningAudioIndex`, `listeningAudioUrl`
- `listeningAudioInitialTimeSec`, `listeningResumeNotice`
- `handleAudioEnded`, `handleAudioTimeUpdate`, `restoreFromDraft`, `reset`
- `listeningAudioProgressRef`

Behavior defaults:

- single mode: uses current step audio
- full mode + `full_audio`: force index `0`
- full mode without `full_audio`: sync audio unit with listening step

### `useExamDraft(...)`
Returns:

- `{ restoredDraftMeta, clearDraft }`

Responsibilities:

- restore draft once per `draftKey`
- persist draft while in-progress
- beforeunload protection for resumable attempts
- restore via one session patch (`hydrateFromDraft`)

### `useExamTracking(...)`
Returns:

- `trackStart`, `queueAnswer`, `flushAnswers`, `trackSubmit`
- `createEventId`, `getTabSessionId`

Responsibilities:

- open/start/answer heartbeat lifecycle
- debounced answer queue
- unload keepalive heartbeat
- internal refs hidden from page

### `useExamSubmit(...)`
Returns:

- `submitLoading`, `submitError`, `setSubmitError`
- `submit`, `autoSubmit`, `retrySubmit`, `chooseScoreMode`

Responsibilities:

- snapshot + normalize payload
- flush tracking
- submit + single-mode result normalize
- clear draft + strikethrough
- AI writing redirect branch

## 3) UI Contracts
### `ExamPage.jsx`
Should only:

- parse route/query
- call hooks
- wire data to UI components
- render mode branches: loading, error, empty, in-progress, submitted, review

### Presentational components
- `ExamHeader`: title/timer/settings/finish trigger
- `ExamErrorBanner`: submit failure + retry action
- `ExamSubmitModals`: finish confirm + scoring choice
- `ExamFooter`: question palette + step navigator
- `ExamResultView`: submitted view + review mode bridge
- `ExamQuestionPalette`, `ExamStepNavigator`: footer primitives

## 4) Utility Layer
- `utils/examSelectors.js`
  - selectors/derived data: slots, steps, step question ranges, footer nav items
- `utils/examStorage.js`
  - `loadExamDraft`, `saveExamDraft`, `clearExamDraft`, `clearExamStrikeThrough`
- `utils/examTracking.js`
  - `buildTrackingPayload`, `createTrackingEventId`, `getTrackingTabSessionId`
- `utils/examMappers.js`
  - route parse, timer/submit mappers, result normalization, highlight extraction

## 5) Implementation Checklist (Reusable)
When refactoring any complex React component, require all checks:

1. Keep public route and import compatibility first (wrapper/facade).
2. Extract loader/session first; only then timer/draft/tracking/submit.
3. Move magic numbers to constants before logic split.
4. Keep UI class names stable during architecture change.
5. Prefer reducer for coupled attempt state.
6. Use one-shot hydration action for draft restore.
7. Hide tracking refs/timers/debounce internals in hook.
8. Keep submit orchestration in a dedicated hook with explicit contract.
9. Add/keep tests for init race, stale fetch, draft restore, tracking retry, auto submit.
10. Run focused tests then routing smoke and build.

## 6) Anti-Patterns to Avoid
- Page file contains long business logic blocks.
- Draft restore calls multiple state setters in sequence without one patch action.
- Tracking refs leaked into page.
- Timer warning state duplicated outside timer domain.
- Routing/query changes trigger full re-init without mode/part relevance.
