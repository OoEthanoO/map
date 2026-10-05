# map

A live map of the configured website subdomains of `ethanyanxu.com`.
Every browser refresh creates new word sizes and two-dimensional positions.
Measured text boxes keep links apart, including after fonts load or the viewport
changes. Unavailable sites stay on the map.

## Development

Use Node.js 22.6 or later (Node.js 24 is used in production).

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

## Domain inventory

The server reads `MAP_DOMAINS_FILE` on each page request. The production file is
`C:\ProgramData\Map\domains.json`, atomically refreshed every five minutes by
the SYSTEM task `map-domain-sync`.

`deploy/windows/sync-domains.ps1` combines every explicit Cloudflare A, AAAA and
CNAME hostname with every connected Vercel project domain, following both APIs'
pagination. This includes nested subdomains and sites assigned through wildcard
DNS. The wildcard itself is not a finite site list; TXT/MX verification and mail
records are not website links. The apex is represented by the masthead.

The sync uses the existing machine-protected Cloudflare and Vercel credentials
on finprint-host. Tokens and DNS record contents are never included in the app,
inventory, API responses, or repository. Failed syncs retain the previous file.
The app preserves its last valid inventory or uses `src/data/domains.json` if
the runtime file is unavailable; the page signals a saved inventory or a sync
older than one hour. `/api/domains` exposes the public inventory and freshness.

Credential settings remain at the server's existing locations:

- Cloudflare: `C:\ProgramData\YanLearn\secrets\cloudflare-ddns.json`
- Vercel: `C:\ProgramData\yanvpn\ddns\vercel-ddns.json`

`/api/pulse` checks the same host list, with bounded concurrency, five-second
deadlines and a one-minute cache. “Answering” means an HTTPS response below 500;
it does not assert that the application is usable or signed in.

## Production

`https://map.ethanyanxu.com` points to `finprint.ethanyanxu.com` through an
explicit DNS-only CNAME. The existing home-server DDNS updater tracks address
changes. Shared Caddy terminates HTTPS and proxies to the active standalone
Next.js release on loopback port 3500 or 3501.

The SYSTEM task `map-deploy` checks `origin/main` every two minutes. A deployment
runs the tests and production build, starts an isolated release and verifies
`/api/health` before switching Caddy. Previous releases and immutable assets are
retained. Commit and push changes to `main` to deploy them.

For setup or repair, run on finprint-host in an administrator PowerShell:

```powershell
& C:\ProgramData\Map\repo\deploy\windows\install.ps1 `
  -CaddyExe C:\Users\ethan\AppData\Local\Microsoft\WinGet\Links\caddy.exe `
  -MainCaddyfile C:\Users\ethan\finprint\scripts\selfhost\Caddyfile `
  -EnableAutoDeploy
& C:\ProgramData\Map\ops\sync-domains.ps1
& C:\ProgramData\Map\ops\deploy.ps1
```

`deploy/windows/dns.ps1` creates only the map CNAME after readiness succeeds and
stores a narrowly scoped rollback record. `dns.ps1 -Rollback` removes that
override only if it still matches the recorded migration. To roll back an app
release, run `C:\ProgramData\Map\ops\activate.ps1 -Rollback`.

Verify public `/api/health` matches the intended commit and has the
`X-Map-Host: finprint-host` response header. Verify `/api/domains` reports
`source: live`, `stale: false` and the current host count. Runtime state and logs
are under `C:\ProgramData\Map`; `domains-status.json` records sync success.
