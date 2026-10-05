import type { Site } from "@/data/sites";

export const DOMAIN = "ethanyanxu.com";
// Sync runs every five minutes. Alert after an hour without a successful sync.
export const STALE_AFTER_MS = 60 * 60 * 1_000;

export type DomainSnapshot = {
  domain: typeof DOMAIN;
  updatedAt: string;
  hosts: string[];
};

/** Fail closed on a damaged snapshot instead of silently losing some names. */
export function parseDomainSnapshot(value: unknown, now = Date.now()): DomainSnapshot {
  if (!value || typeof value !== "object") throw new Error("Invalid inventory");
  const input = value as Record<string, unknown>;
  if (input.domain !== DOMAIN || !Array.isArray(input.hosts) || !input.hosts.length) {
    throw new Error("Invalid inventory domain or hosts");
  }
  const updatedAt = typeof input.updatedAt === "string" ? Date.parse(input.updatedAt) : NaN;
  if (!Number.isFinite(updatedAt) || updatedAt > now + 5 * 60 * 1_000) {
    throw new Error("Invalid inventory timestamp");
  }
  if (input.hosts.length > 10_000) throw new Error("Inventory is too large");

  const hosts = input.hosts.map((value: unknown) => {
    if (typeof value !== "string") throw new Error("Invalid hostname");
    const host = value.toLowerCase().replace(/\.$/, "");
    if (
      host.length > 253 ||
      !host.endsWith(`.${DOMAIN}`) ||
      !host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    ) {
      throw new Error("Invalid or out-of-scope hostname");
    }
    return host;
  });

  return {
    domain: DOMAIN,
    updatedAt: new Date(updatedAt).toISOString(),
    hosts: [...new Set(hosts)].sort(),
  };
}

export function sitesFromSnapshot(snapshot: DomainSnapshot): Site[] {
  return snapshot.hosts.map((host) => ({ host, label: host.slice(0, -(DOMAIN.length + 1)) }));
}

export function isSnapshotStale(snapshot: DomainSnapshot, now = Date.now()): boolean {
  return now - Date.parse(snapshot.updatedAt) > STALE_AFTER_MS;
}

export function createInventoryReader(
  fallback: unknown,
  readSnapshot: () => Promise<unknown>,
  now = Date.now,
) {
  let lastKnown: DomainSnapshot | null = null;
  return async function getInventory() {
    let snapshot: DomainSnapshot;
    let source: "live" | "last-known" | "snapshot";
    try {
      snapshot = parseDomainSnapshot(await readSnapshot(), now());
      lastKnown = snapshot;
      source = "live";
    } catch {
      snapshot = lastKnown ?? parseDomainSnapshot(fallback, now());
      source = lastKnown ? "last-known" : "snapshot";
    }
    return { ...snapshot, sites: sitesFromSnapshot(snapshot), source, stale: isSnapshotStale(snapshot, now()) };
  };
}
