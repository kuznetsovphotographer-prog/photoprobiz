$ErrorActionPreference = 'Stop'
$cli = 'C:\Users\theal\.codex\skills\playwright\scripts\playwright_cli.cmd'
$measure = @(1024, 768, 430, 390, 375, 360, 320, 480, 640, 960, 961, 1200, 1920)
$baseWidths = @(320, 480, 640, 960, 961, 1200)
foreach ($width in $measure) {
    & $cli -s=photoprobiz-responsive resize $width 1000 | Out-Null
    & $cli -s=photoprobiz-responsive run-code --filename scripts/audit-responsive-browser.js | Set-Content -LiteralPath "audit\browser-$width.log" -Encoding utf8
    $raw = Get-Content -LiteralPath "audit\browser-$width.log" -Raw -Encoding utf8
    $match = [regex]::Match($raw, '(?s)### Result\s*(.*?)\s*### Ran Playwright code')
    if (-not $match.Success) { throw "Missing browser JSON for $width" }
    $json = $match.Groups[1].Value
    $data = $json | ConvertFrom-Json
    Set-Content -LiteralPath "audit\browser-$width.json" -Value $json -Encoding utf8
    if ($baseWidths -contains $width) {
        & $cli -s=photoprobiz-responsive run-code --filename scripts/audit-layout-browser.js | Set-Content -LiteralPath "audit\layout-$width.log" -Encoding utf8
        $raw = Get-Content -LiteralPath "audit\layout-$width.log" -Raw -Encoding utf8
        $match = [regex]::Match($raw, '(?s)### Result\s*(.*?)\s*### Ran Playwright code')
        if (-not $match.Success) { throw "Missing layout JSON for $width" }
        $json = $match.Groups[1].Value
        $null = $json | ConvertFrom-Json -Depth 100
        Set-Content -LiteralPath "audit\layout-$width.json" -Value $json -Encoding utf8
    } else {
        & $cli -s=photoprobiz-responsive run-code --filename scripts/audit-responsive-sections.js | Set-Content -LiteralPath "audit\sections-$width.log" -Encoding utf8
        $raw = Get-Content -LiteralPath "audit\sections-$width.log" -Raw -Encoding utf8
        if ($raw -match '### Error') { throw "Screenshot error for $width" }
    }
    Write-Output "Captured ${width}: height=$($data.height), blocks=$($data.blocks.Count)"
}

