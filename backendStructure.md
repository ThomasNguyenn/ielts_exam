# Backend Structure Playbook (Supporting Complex Frontend Flows)

## 1) Boundary and Stable Contracts
Frontend complex pages should rely on stable backend contracts. For test/exam flow, backend keeps these endpoints:

- `GET /api/tests/:id/exam`
- `POST /api/tests/:id/activity/open`
- `POST /api/tests/:id/activity/start`
- `POST /api/tests/:id/activity/heartbeat`
- `PATCH /api/tests/:id/activity/answer`
- `POST /api/tests/:id/submit`

Current route/controller mapping:

- `backend/routes/test.route.js`
- `backend/controllers/test.controller.js`
- grading/submission domain in `backend/services/testSubmission.service.js`

## 2) Layering Pattern
### Route layer
- HTTP mapping + auth middleware + cache invalidation policy
- no business logic

### Controller layer
- parse request context
- normalize tracking context (`hwctx`, `resource_ref_*`, event metadata)
- call services
- translate errors to HTTP responses

### Service layer
- domain business logic only
- submission grading and persistence (`submitExamFlow`)
- activity bridge calls (`trackHomeworkActivity*`)

### Model/data layer
- Mongoose models for Tests, Attempts, Writing submissions
- persistence details isolated from controller

## 3) Contracts Frontend Must Preserve
For exam submit payload (client -> server):

- `answers: string[]`
- `writing: string[]`
- `timeTaken: number`
- `student_highlights: string[]`
- `isPractice: boolean`
- `singleModeMeta: { startSlotIndex, endSlotIndex, stepIndex? } | null`
- tracking context fields (`hwctx`, `resource_ref_type`, `resource_ref_id`, `event_id`, `tab_session_id`, `client_ts`)

For activity answer payload:

- `save_seq`
- `updates: [{ question_key, answer_value }]`

For submit response fields consumed by frontend:

- `score`, `total`, `wrong`, `question_review`, `timeTaken`
- `writingSubmissionId`
- optional gamification fields

## 4) Single-Mode and Attempt Semantics
Implemented in service layer (`testSubmission.service.js`):

- `normalizeSingleModeMeta`
- `sliceGradeResultForSingleMode`
- `submitExamFlow`

Policy currently used:

- practice single-mode can submit without full attempt persistence rules
- server can slice objective review for single-mode via `singleModeMeta`
- frontend may still perform extra client-side normalization for defense-in-depth

## 5) Tracking Lifecycle Semantics
Server-side handlers:

- `submitExamActivityOpen`
- `submitExamActivityStart`
- `submitExamActivityHeartbeat`
- `submitExamActivityAnswer`

Expected frontend behavior:

1. send `open` once after exam view ready
2. send `start` at first user interaction
3. send answer patches debounced and retriable
4. send heartbeat interval + visibility transitions
5. send unload heartbeat with keepalive

## 6) Backend Checklist for Future Complex Components
When adding backend support for new complex React flow:

1. Define endpoint contract first (request/response schema and idempotency semantics).
2. Keep controller thin; push policy to service.
3. Support partial progress APIs (debounced patch model) when UI has drafts.
4. Include event metadata fields for tracing (`event_id`, `tab_session_id`, `client_ts`).
5. Avoid breaking existing response keys; add new keys backward-compatibly.
6. Add targeted tests for validation, happy path, retry/failure path.
7. Document route-to-service mapping and payload contract in structure docs.

## 7) Regression Guardrails
- Do not rename/remove existing test exam endpoints without compatibility layer.
- Keep `submit` response shape backward compatible with current frontend consumers.
- Treat tracking APIs as best-effort: failures should not block exam submission.
- Validate single-mode slicing logic with both server and frontend integration tests.
