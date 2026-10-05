[CmdletBinding()]
param([string]$Root = 'C:\ProgramData\Map', [string]$Ref = 'origin/main', [switch]$PrepareOnly)
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-Administrator
$lock = $null; $next = $null; $activated = $false
try {
    $lock = [IO.File]::Open((Join-Path $Root 'deploy.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    $config = Read-Json (Join-Path $Root 'server.json')
    $repo = Join-Path $Root 'repo'
    $log = Join-Path $Root 'logs\deploy.log'
    $env:NEXT_TELEMETRY_DISABLED = '1'
    $env:GIT_TERMINAL_PROMPT = '0'
    $gitOptions = @('-c', ('safe.directory=' + ($repo -replace '\\','/')), '-C', $repo)
    Invoke-Tool $config.git ($gitOptions + @('fetch','origin','main')) $log
    $commit = (& $config.git @gitOptions rev-parse --verify ($Ref + '^{commit}')).Trim()
    if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[a-f0-9]{40}$') { throw 'Invalid revision.' }
    $active = Read-Json (Join-Path $Root 'active.json')
    if ($active -and $active.commit -eq $commit -and (Test-Release $active 5)) { Write-Output "Already serving $commit"; return }
    $port = if ($active -and $active.port -eq 3500) { 3501 } else { 3500 }
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port is occupied. Inspect saved/prepared releases before deploying." }
    $dirty = & $config.git @gitOptions status --porcelain
    if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Deployment checkout is not clean; refusing to overwrite it.' }
    Invoke-Tool $config.git ($gitOptions + @('checkout','--detach',$commit)) $log
    $env:NODE_ENV = 'development'
    Set-Location $repo
    Invoke-Tool $config.npm @('ci','--include=dev','--no-audit','--no-fund') $log
    $env:NODE_ENV = 'production'
    Invoke-Tool $config.npm @('run','build') $log
    $releaseId = $commit.Substring(0,12) + '-' + (Get-Date -Format 'yyyyMMddHHmmss')
    $release = Join-Path $Root ('releases\' + $releaseId)
    $app = Join-Path $release 'app'
    New-Item -ItemType Directory -Path $app,(Join-Path $release 'ops') -Force | Out-Null
    Copy-Item -Path (Join-Path $repo '.next\standalone\*') -Destination $app -Recurse -Force
    if (Test-Path -LiteralPath (Join-Path $repo 'public')) { Copy-Item -LiteralPath (Join-Path $repo 'public') -Destination (Join-Path $app 'public') -Recurse -Force }
    Copy-Item -LiteralPath (Join-Path $repo '.next\static') -Destination (Join-Path $app '.next\static') -Recurse -Force
    Copy-Item -Path (Join-Path $repo 'deploy\windows\*.ps1') -Destination (Join-Path $release 'ops') -Force
    # Keep immutable assets for visitors whose tabs span a release switch.
    Copy-Item -Path (Join-Path $repo '.next\static\*') -Destination (Join-Path $Root 'static') -Recurse -Force
    $next = [pscustomobject]@{commit=$commit;release=$release;port=$port;taskName=('map-web-'+$releaseId);createdAt=(Get-Date).ToUniversalTime().ToString('o')}
    Write-Json (Join-Path $release 'release.json') $next
    Register-WebTask $Root $next
    if (-not (Test-Release $next)) { throw 'Readiness failed. Existing traffic is unchanged.' }
    if ($PrepareOnly) {
        Write-Json (Join-Path $Root 'prepared.json') $next
        $activated = $true
        Write-Output "Prepared $commit on loopback $port."
        return
    }
    Switch-Caddy $Root $config $port
    $activated = $true
    if ($active) { Write-Json (Join-Path $Root 'previous.json') $active }
    Write-Json (Join-Path $Root 'active.json') $next
    Copy-Item -Path (Join-Path $repo 'deploy\windows\*.ps1') -Destination (Join-Path $Root 'ops') -Force
    if ($active) { Start-Sleep -Seconds 20; Stop-WebTask $Root $active }
    Write-Output "Serving $commit on port $port."
} finally {
    if ($next -and -not $activated) { Stop-WebTask $Root $next }
    if ($lock) { $lock.Dispose() }
}
