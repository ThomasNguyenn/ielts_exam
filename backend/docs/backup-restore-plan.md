# Backup and Restore Plan

## Scope
- MongoDB data (`mongodump` / `mongorestore`)
- Uploaded assets (`backend/uploads`)

## Backup schedule
- `MongoDB`: daily full backup at 02:00 local time
- `Uploads`: every 6 hours
- `Retention`: keep 14 daily backups + 8 weekly backups

## Backup commands
- Mongo backup:
  - `npm run backup:mongo`
- Uploads backup:
  - `npm run backup:uploads`

## Restore commands
- Mongo restore:
  - `npm run restore:mongo -- -ArchivePath .\backups\mongo\20260213-020000\dump.archive.gz`
- Uploads restore:
  - `npm run restore:uploads -- -ArchivePath .\backups\uploads\uploads-20260213-020000.zip`

## Recovery procedure
1. Stop API server instances.
2. Restore MongoDB from the selected backup.
3. Restore uploads archive.
4. Start API server and run `/api/health` + `/api/health/db`.
5. Validate key user flows (login, test list, writing submission).

## Recovery objectives
- `RPO`: <= 24 hours (data loss window)
- `RTO`: <= 60 minutes (restore time)

## Notes
- Scripts expect `mongodump` and `mongorestore` to be installed and available on PATH.
- `MONGO_URI` must be set before Mongo backup/restore scripts.
