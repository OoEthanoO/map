# Read configured application domains, including names covered only by wildcard DNS.
# Existing server credentials stay on the server and are never returned to callers.
function Get-VercelHosts {
    [CmdletBinding()]
    param(
        [string]$SettingsPath = 'C:\ProgramData\yanvpn\ddns\vercel-ddns.json'
    )

    Set-StrictMode -Version Latest
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    $headers = $null
    $plain = $null
    $cipher = $null
    $failure = 'Vercel inventory credentials could not be loaded.'

    # Both v9 endpoints were verified against the live account on 2026-10-05.
    # These v9 endpoints both advance with until (v10 projects instead uses from).
    function Read-VercelPages {
        param([string]$Path, [string]$Collection, [string]$CursorParameter)
        $cursor = $null
        $seen = @{}
        $items = [Collections.Generic.List[object]]::new()
        do {
            $uri = 'https://api.vercel.com' + $Path + '?limit=100&' + $scopeQuery
            if ($null -ne $cursor) {
                $uri += '&' + $CursorParameter + '=' + [Uri]::EscapeDataString([string]$cursor)
            }
            $response = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 25 -ErrorAction Stop
            if ($null -eq $response -or
                $response.PSObject.Properties.Name -notcontains $Collection -or
                $response.PSObject.Properties.Name -notcontains 'pagination' -or
                $null -eq $response.pagination -or
                $response.pagination.PSObject.Properties.Name -notcontains 'next') {
                throw 'Invalid Vercel inventory response.'
            }
            foreach ($item in $response.$Collection) { $items.Add($item) }
            $cursor = $response.pagination.next
            if ($null -ne $cursor) {
                if ([string]::IsNullOrWhiteSpace([string]$cursor) -or $seen.ContainsKey([string]$cursor)) {
                    throw 'Vercel inventory pagination did not advance.'
                }
                $seen[[string]$cursor] = $true
            }
        } while ($null -ne $cursor)
        return $items.ToArray()
    }

    try {
        $settings = Get-Content -Raw -LiteralPath $SettingsPath | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace([string]$settings.TokenPath) -or
            [string]::IsNullOrWhiteSpace([string]$settings.TeamSlug)) {
            throw 'Invalid Vercel inventory settings.'
        }
        Add-Type -AssemblyName System.Security
        $cipher = [Convert]::FromBase64String([IO.File]::ReadAllText($settings.TokenPath))
        $plain = [Security.Cryptography.ProtectedData]::Unprotect(
            $cipher, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
        $headers = @{ Authorization = ('Bearer ' + [Text.Encoding]::UTF8.GetString($plain)) }
        [Array]::Clear($plain, 0, $plain.Length)
        $plain = $null
        $scopeQuery = 'slug=' + [Uri]::EscapeDataString($settings.TeamSlug)

        $failure = 'Vercel project inventory request failed or returned incomplete data.'
        $projects = @(Read-VercelPages -Path '/v9/projects' -Collection 'projects' -CursorParameter 'until')
        $hosts = [Collections.Generic.List[string]]::new()
        $seenProjects = @{}
        foreach ($project in $projects) {
            if ($project.PSObject.Properties.Name -notcontains 'id' -or
                [string]::IsNullOrWhiteSpace([string]$project.id)) {
                throw 'Invalid Vercel project identifier.'
            }
            if ($seenProjects.ContainsKey([string]$project.id)) { continue }
            $seenProjects[[string]$project.id] = $true
            $failure = 'Vercel domain inventory request failed or returned incomplete data.'
            $path = '/v9/projects/' + [Uri]::EscapeDataString($project.id) + '/domains'
            $domains = @(Read-VercelPages -Path $path -Collection 'domains' -CursorParameter 'until')
            foreach ($domain in $domains) {
                if ($domain.PSObject.Properties.Name -notcontains 'name') {
                    throw 'Invalid Vercel domain record.'
                }
                $name = ([string]$domain.name).ToLowerInvariant()
                if ($name.Length -le 253 -and
                    $name -match '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+ethanyanxu\.com$') {
                    $hosts.Add($name)
                }
            }
        }
        return @($hosts.ToArray() | Sort-Object -Unique)
    } catch {
        # Do not propagate request objects, response bodies, paths, or credentials.
        throw $failure
    } finally {
        if ($null -ne $plain) { [Array]::Clear($plain, 0, $plain.Length) }
        if ($null -ne $cipher) { [Array]::Clear($cipher, 0, $cipher.Length) }
        if ($null -ne $headers) { $headers.Clear() }
        $plain = $null
        $cipher = $null
        $headers = $null
    }
}
