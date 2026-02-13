param(
  [string]$MongoUri = $env:MONGO_URI,
  [string]$OutputRoot = ".\backups\mongo"
)

if (-not $MongoUri) {
  throw "MONGO_URI is required. Set env:MONGO_URI or pass -MongoUri."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $OutputRoot $timestamp

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

Write-Host "Creating Mongo backup at $outputDir"
mongodump --uri="$MongoUri" --gzip --archive="$outputDir\dump.archive.gz"

if ($LASTEXITCODE -ne 0) {
  throw "mongodump failed with exit code $LASTEXITCODE"
}

Write-Host "Mongo backup complete: $outputDir\dump.archive.gz"
