param(
  [string]$MongoUri = $env:MONGO_URI,
  [Parameter(Mandatory = $true)][string]$ArchivePath
)

if (-not $MongoUri) {
  throw "MONGO_URI is required. Set env:MONGO_URI or pass -MongoUri."
}

if (-not (Test-Path $ArchivePath)) {
  throw "Archive not found: $ArchivePath"
}

Write-Host "Restoring Mongo backup from $ArchivePath"
mongorestore --uri="$MongoUri" --drop --gzip --archive="$ArchivePath"

if ($LASTEXITCODE -ne 0) {
  throw "mongorestore failed with exit code $LASTEXITCODE"
}

Write-Host "Mongo restore complete."
