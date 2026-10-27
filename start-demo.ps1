$ErrorActionPreference = 'Stop'
$url = 'http://127.0.0.1:5173/'
$running = $false
try {
    $check = Invoke-RestMethod ($url + 'data/provenance.json') -TimeoutSec 2
    $running = $check.release_commit -eq 'f4d76c75be22c40eb0d1abdd1bde6a2c443df198'
} catch {}
if (-not $running) {
    if (-not (Test-Path -LiteralPath "$PSScriptRoot\dist\index.html")) { throw 'Build missing. Run npm ci and npm run build first.' }
    $node = (Get-Command node.exe).Source
    $vite = Join-Path $PSScriptRoot 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path -LiteralPath $vite)) { throw 'Dependencies missing. Run npm ci first.' }
    $runtime = Join-Path $PSScriptRoot '.runtime'
    New-Item -ItemType Directory -Path $runtime -Force | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $proc = Start-Process -FilePath $node -ArgumentList @(('"' + $vite + '"'),'preview','--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$runtime\server-$stamp.log" -RedirectStandardError "$runtime\server-$stamp.err.log"
    $proc.Id | Set-Content "$runtime\server-$stamp.pid"
    for ($i=0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 200
        try { $check = Invoke-RestMethod ($url + 'data/provenance.json') -TimeoutSec 1; if ($check.release_commit -eq 'f4d76c75be22c40eb0d1abdd1bde6a2c443df198') { $running=$true; break } } catch {}
        if ($proc.HasExited) { break }
    }
    if (-not $running) { throw "Server did not start. Inspect $runtime or check port 5173." }
}
Write-Host "Demo: $url"
Start-Process $url
