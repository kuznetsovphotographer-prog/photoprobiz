[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 4173,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$server = $null

function Stop-LocalServer {
    if ($null -ne $script:server -and -not $script:server.HasExited) {
        Stop-Process -Id $script:server.Id -Force -ErrorAction SilentlyContinue
    }
}

function Get-LocalNetworkUrls {
    $privateIPv4 = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.AddressState -eq 'Preferred' -and
            $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)'
        } |
        Sort-Object InterfaceIndex, SkipAsSource |
        Select-Object -ExpandProperty IPAddress -Unique

    return @($privateIPv4 | ForEach-Object { "http://$($_):$Port/" })
}

try {
    Set-Location $projectRoot
    $node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
    if ($null -eq $node) { $node = Get-Command 'node' -ErrorAction SilentlyContinue }
    $npm = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
    if ($null -eq $node -or $null -eq $npm) {
        throw 'Node.js or npm was not found. Install Node.js 22.12+ and run this file again.'
    }

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $listener) {
        throw "Port $Port is already used by PID $($listener.OwningProcess). Stop it and run this file again."
    }

    Write-Host ''
    Write-Host 'Building the production website...' -ForegroundColor Cyan
    & $npm.Source run build
    if ($LASTEXITCODE -ne 0) { throw "Website build ended with code $LASTEXITCODE." }

    Write-Host 'Starting the local network server...' -ForegroundColor Cyan
    $server = Start-Process -FilePath $node.Source -ArgumentList @('scripts/serve.mjs', '--port', $Port, '--host', '0.0.0.0') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru

    $ready = $false
    foreach ($attempt in 1..30) {
        Start-Sleep -Milliseconds 300
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
    }
    if (-not $ready) {
        throw "The local server did not answer on port $Port."
    }

    $networkUrls = @(Get-LocalNetworkUrls)
    Write-Host ''
    Write-Host 'THIS COMPUTER:' -ForegroundColor Green
    Write-Host "http://127.0.0.1:$Port/" -ForegroundColor Green
    if ($networkUrls.Count -gt 0) {
        Write-Host ''
        Write-Host 'OPEN ON A PHONE OR COMPUTER IN THE SAME WI-FI NETWORK:' -ForegroundColor Green
        $networkUrls | ForEach-Object { Write-Host $_ -ForegroundColor Green }
        try { Set-Clipboard -Value $networkUrls[0] } catch { }
        Write-Host ''
        Write-Host 'The first local-network address has been copied to the clipboard.' -ForegroundColor Cyan
    } else {
        Write-Host ''
        Write-Host 'No private Wi-Fi or LAN address was found. The site is available only on this computer until it connects to a local network.' -ForegroundColor Yellow
    }

    if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port/" }

    Write-Host ''
    Write-Host 'This server is available only inside your local network while this window stays open. Ctrl+C stops it.' -ForegroundColor Yellow
    while (-not $server.HasExited) { Start-Sleep -Seconds 1 }
    if ($server.ExitCode -ne 0) { throw "The local server ended with code $($server.ExitCode)." }
}
catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
finally {
    Stop-LocalServer
}
