# AI Queue Mode (Redis + BullMQ)

This project supports asynchronous AI grading for `writing` and `speaking`.

## Why
- API returns faster under heavy traffic.
- AI work is moved to background workers.
- Better stability when many users submit at once.

## Environment
### Critical (must set in production)
- `AI_ASYNC_MODE=true` (enables queue mode)
- `REDIS_URL=redis://<host>:6379` (BullMQ backend)
- `GEMINI_API_KEY=<secret>` (final AI grading for speaking/writing)
- `OPENAI_API_KEY=<secret>` (required when `SPEAKING_FAST_PIPELINE=true`)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (required if you want speaking audio auto-cleanup after scoring)

### Recommended (set explicitly)
- `AI_WORKER_CONCURRENCY=2` (start 2, tune to 3-4 only after monitoring CPU/RAM/latency)
- `GEMINI_PRIMARY_MODEL=gemini-2.5-flash`
- `GEMINI_FALLBACK_MODEL=gemini-2.0-flash`
- `OPENAI_TIMEOUT_MS`
- `GEMINI_TIMEOUT_MS`
- `SPEAKING_GEMINI_TIMEOUT_MS=25000` (speaking-specific timeout)
- `SPEAKING_GEMINI_MAX_ATTEMPTS=2` (speaking-specific retry cap)
- `SPEAKING_ANALYSIS_MAX_OUTPUT_TOKENS=1200` (reduce long responses)
- `SPEAKING_MOCK_MAX_OUTPUT_TOKENS=220`

### Fast provisional pipeline (feature-flagged)
- `SPEAKING_FAST_PIPELINE=true` (enable provisional fast-score pipeline)
- `SPEAKING_FAST_SCORE_TIMEOUT_MS=3500`
- `SPEAKING_STT_MODEL=gpt-4o-mini-transcribe`
- `SPEAKING_PROVISIONAL_FORMULA_VERSION=formula_v1`

### Optional tuning
- `SPEAKING_FILLER_WORDS=um,uh,like,you know,actually,basically`
- `AI_QUEUE_REMOVE_ON_COMPLETE=200` (reduce to 50-100 if Redis memory is tight)
- `AI_QUEUE_REMOVE_ON_FAIL=500` (reduce to 100-300 if Redis memory is tight)
- `API_RESPONSE_CACHE_TAG_TTL_MULTIPLIER=2`
- `API_RESPONSE_CACHE_TAG_TTL_MIN_SEC=60`
- `API_RESPONSE_CACHE_TAG_TTL_MAX_SEC=600` (lowering this reduces stale tag-set memory)

## Redis memory policy recommendation (shared queue + cache)
- If queue and cache share one Redis, prefer `maxmemory-policy noeviction`.
- Rationale: eviction can delete BullMQ keys and break queue correctness.
- In this setup, cache writes are best-effort and already bypass when Redis is constrained.
- If possible, split Redis instances:
  - Redis A: BullMQ + critical coordination (noeviction)
  - Redis B: response cache/rate-limit (allkeys-lru or volatile-lru)

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

