# Production Runbook

## 1) Release Gate (must pass before deploy)

Run locally (or in CI):

```bash
# backend
cd backend
npm ci
npm run check

# frontend
cd ../frontend
npm ci
npm run check
```

`frontend` check includes:
- unit/integration tests
- production build
- bundle budget guard (`check:bundle`)

## 2) Required Environment (Backend)

Minimum required:
- `MONGO_URI`
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Production-only requirement:
- `FRONTEND_ORIGINS` (comma-separated `http(s)` origins)

Recommended production hardening:
- `CORS_ALLOW_NO_ORIGIN=false`
- `SERVE_LOCAL_UPLOADS=false` (when Cloudinary is configured)
- `NODE_ENV=production`

Optional but recommended:
- `JWT_REFRESH_SECRET` (separate from access secret)
- `OPENAI_API_KEY`, `GEMINI_API_KEY`
- `AI_ASYNC_MODE=true` + `REDIS_URL` (if async AI workers enabled)

## 3) Deploy Steps

1. Deploy backend first.
2. Validate backend health:
   - `GET /api/health`
   - `GET /api/health/db`
3. Deploy frontend.
4. Purge CDN cache (if applicable).
5. Execute smoke tests (section 4).

## 4) Post-Deploy Smoke Test

Critical flows:
1. Login -> refresh token -> logout.
2. Forgot password -> reset password.
3. Protected route redirect for anonymous user.
4. Admin/manage route rejection for non-admin.
5. Submit one exam attempt (at least one reading/listening and one writing path).
6. Confirm no unexpected 5xx spikes in logs.

## 5) Rollback Plan

1. Roll back frontend to previous artifact if UI regressions only.
2. Roll back backend to previous artifact if API/auth regression.
3. If migration/data issue:
   - stop writes if needed,
   - restore database snapshot,
   - redeploy previous backend version.
4. Re-run smoke tests after rollback.

## 6) Backup / Restore Drill

Use existing backend scripts:

```bash
cd backend
npm run backup:mongo
npm run backup:uploads

# restore
npm run restore:mongo
npm run restore:uploads
```

Schedule a restore drill regularly (at least monthly).

## 7) Operational Notes

- `initAchievements()` is no longer auto-run at app startup; seed data should be handled by one-off admin/migration scripts.
- Keep `FRONTEND_ORIGINS` explicit and minimal in production.
- Treat any bundle budget failure as a release blocker unless manually approved.
