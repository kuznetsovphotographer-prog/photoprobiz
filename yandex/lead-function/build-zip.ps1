$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'CRM lead-function tests failed' }
  $projectRoot = (Resolve-Path -LiteralPath '../..').Path
  $outputDir = Join-Path $projectRoot 'output'
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
  $zipPath = Join-Path $outputDir 'photoprobiz-crm-delete-periods.zip'
  $files = @('index.js', 'storage.js', 'crm-storage.js', 'admin-auth.js', 'admin-page.js', 'package.json', 'package-lock.json')
  Compress-Archive -LiteralPath $files -DestinationPath $zipPath -Force
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName })
    if (Compare-Object $files $entries) { throw 'Unexpected CRM archive contents' }
  } finally { $archive.Dispose() }
  Get-FileHash -LiteralPath $zipPath -Algorithm SHA256
  Write-Output $zipPath
} finally { Pop-Location }
