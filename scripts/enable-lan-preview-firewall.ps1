#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 4173
)

$ErrorActionPreference = 'Stop'
$ruleName = "PhotoProBiz Local Preview $Port"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($null -eq $existing) {
    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Description 'Allows the PhotoProBiz preview inside a private local network only.' `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $Port `
        -Profile Private | Out-Null
} else {
    $existing | Set-NetFirewallRule -Enabled True -Direction Inbound -Action Allow -Profile Private | Out-Null
}

Write-Host "Local network access is enabled for private TCP port $Port." -ForegroundColor Green
