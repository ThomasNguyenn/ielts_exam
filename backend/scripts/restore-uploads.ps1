param(
  [Parameter(Mandatory = $true)][string]$ArchivePath,
  [string]$UploadsPath = ".\uploads"
)

if (-not (Test-Path $ArchivePath)) {
  throw "Archive not found: $ArchivePath"
}

if (Test-Path $UploadsPath) {
  Remove-Item -Path $UploadsPath -Recurse -Force
}

New-Item -ItemType Directory -Path $UploadsPath -Force | Out-Null

Write-Host "Restoring uploads from $ArchivePath to $UploadsPath"
Expand-Archive -Path $ArchivePath -DestinationPath $UploadsPath -Force
Write-Host "Uploads restore complete."
