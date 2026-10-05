# Read the authoritative DNS zone on the server. Only public hostnames leave this script.
[CmdletBinding()]
param(
    [string]$Root = 'C:\ProgramData\Map',
    [string]$SettingsPath = 'C:\ProgramData\YanLearn\secrets\cloudflare-ddns.json'
)
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-Administrator
$lock = $null
$headers = $null
try {
    $lock = [IO.File]::Open((Join-Path $Root 'domains.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    $settings = Read-Json $SettingsPath
    if ($settings.ZoneId -notmatch '^[a-f0-9]{32}$') { throw 'Invalid Cloudflare zone identifier.' }
    Add-Type -AssemblyName System.Security
    $plain = [Security.Cryptography.ProtectedData]::Unprotect(
        [Convert]::FromBase64String([IO.File]::ReadAllText($settings.TokenPath)), $null,
        [Security.Cryptography.DataProtectionScope]::LocalMachine)
    $headers = @{Authorization = ('Bearer ' + [Text.Encoding]::UTF8.GetString($plain))}
    [Array]::Clear($plain, 0, $plain.Length)
    $records = @()
    $page = 1
    do {
        try {
            $response = Invoke-RestMethod -Uri ('https://api.cloudflare.com/client/v4/zones/{0}/dns_records?per_page=100&page={1}' -f $settings.ZoneId,$page) -Headers $headers -TimeoutSec 25
        } catch { throw 'Cloudflare inventory request failed. The previous inventory is retained.' }
        if (-not $response.success -or $null -eq $response.result_info.total_pages) { throw 'Invalid DNS inventory response.' }
        $records += @($response.result)
        $page++
    } while ($page -le $response.result_info.total_pages)
    $hosts = @($records | Where-Object {
        $_.type -in 'A','AAAA','CNAME' -and $_.name -match '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+ethanyanxu\.com$'
    } | ForEach-Object { $_.name.ToLowerInvariant() } | Sort-Object -Unique)
    if ($hosts.Count -eq 0) { throw 'DNS returned no website hosts; refusing to replace the inventory.' }
    # A wildcard DNS record has infinitely many matches. Enumerate the actual
    # application assignments at Vercel to discover names served through it.
    . (Join-Path $PSScriptRoot 'vercel-domains.ps1')
    $vercelHosts = @(Get-VercelHosts)
    $hosts = @($hosts + $vercelHosts | Sort-Object -Unique)
    $now = [DateTime]::UtcNow.ToString('o')
    Write-Json (Join-Path $Root 'domains.json') ([ordered]@{
        domain = 'ethanyanxu.com'; updatedAt = $now; hosts = $hosts
    })
    Write-Json (Join-Path $Root 'domains-status.json') @{success=$true; checkedAt=$now; count=$hosts.Count}
    Write-Output ('Updated map inventory: ' + $hosts.Count + ' configured hosts.')
} catch {
    Write-Json (Join-Path $Root 'domains-status.json') @{success=$false; checkedAt=[DateTime]::UtcNow.ToString('o'); error=$_.Exception.Message}
    throw
} finally {
    $headers = $null
    if ($lock) { $lock.Dispose() }
}
