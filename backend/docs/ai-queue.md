# AI Queue Mode (Redis + BullMQ)

This project supports asynchronous AI grading for `writing` and `speaking`.

## Why
- API returns faster under heavy traffic.
- AI work is moved to background workers.
- Better stability when many users submit at once.

## Environment
- `AI_ASYNC_MODE=true`
- `REDIS_URL=redis://<host>:6379`
- Optional:
  - `AI_WORKER_CONCURRENCY=1`
  - `OPENAI_TIMEOUT_MS`
  - `GEMINI_TIMEOUT_MS`

## Run
1. Start API:
   - `npm run start` (or `npm run dev`)
2. Start AI worker (separate process):
   - `npm run worker:ai`

## API behavior
- If queue mode is on:
  - Speaking submit and writing AI scoring return `202` with `status: processing`.
  - Frontend should poll status endpoints.
- If queue mode is off:
  - API falls back to synchronous grading.

