param(
  [string]$UploadsPath = ".\uploads",
  [string]$OutputRoot = ".\backups\uploads"
)

if (-not (Test-Path $UploadsPath)) {
  throw "Uploads path not found: $UploadsPath"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$archivePath = Join-Path $OutputRoot "uploads-$timestamp.zip"

Write-Host "Creating uploads backup at $archivePath"
Compress-Archive -Path "$UploadsPath\*" -DestinationPath $archivePath -Force
Write-Host "Uploads backup complete."
