export type Pulse = {
  host: string;
  /** HTTPS answered below 500, or was unavailable. This never filters the map. */
  state: "up" | "down";
  status: number | null;
  ms: number;
};

export type PulseReport = {
  checkedAt: string;
  results: Pulse[];
};

type PulseOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  concurrency?: number;
  timeoutMs?: number;
  ttlMs?: number;
};

export function createPulseService({
  fetchImpl = fetch,
  now = Date.now,
  concurrency = 8,
  timeoutMs = 5_000,
  ttlMs = 60_000,
}: PulseOptions = {}) {
  let cache: { key: string; at: number; report: PulseReport } | null = null;
  const pending = new Map<string, Promise<PulseReport>>();

  async function ping(host: string): Promise<Pulse> {
    const started = now();
    // A single deadline covers both requests, including the HEAD fallback.
    const signal = AbortSignal.timeout(timeoutMs);
    for (const method of ["HEAD", "GET"] as const) {
      try {
        const response = await fetchImpl(`https://${host}/`, {
          method,
          redirect: "follow",
          cache: "no-store",
          signal,
          headers: { "user-agent": "map.ethanyanxu.com pulse" },
        });
        await response.body?.cancel();
        if (method === "HEAD" && (response.status === 405 || response.status === 501)) continue;
        return { host, state: response.status < 500 ? "up" : "down", status: response.status, ms: now() - started };
      } catch {
        break;
      }
    }
    return { host, state: "down", status: null, ms: now() - started };
  }

  async function check(hosts: readonly string[]): Promise<PulseReport> {
    const results = new Array<Pulse>(hosts.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), hosts.length) }, async () => {
      while (next < hosts.length) {
        const index = next++;
        results[index] = await ping(hosts[index]);
      }
    }));
    return { checkedAt: new Date(now()).toISOString(), results };
  }

  return {
    getReport(hosts: readonly string[]): Promise<PulseReport> {
      const key = hosts.join("\n");
      if (cache?.key === key && now() - cache.at < ttlMs) return Promise.resolve(cache.report);
      const existing = pending.get(key);
      if (existing) return existing;
      const promise = check(hosts)
        .then((report) => {
          cache = { key, at: now(), report };
          return report;
        })
        .finally(() => pending.delete(key));
      pending.set(key, promise);
      return promise;
    },
  };
}
