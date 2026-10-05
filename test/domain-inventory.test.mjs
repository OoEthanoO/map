import assert from "node:assert/strict";
import test from "node:test";
import {
  createInventoryReader,
  isSnapshotStale,
  parseDomainSnapshot,
  sitesFromSnapshot,
  STALE_AFTER_MS,
} from "../src/lib/domain-inventory-core.ts";
import fallback from "../src/data/domains.json" with { type: "json" };

const now = Date.parse("2026-10-05T22:00:00Z");
const snapshot = (hosts = ["www.ethanyanxu.com"]) => ({
  domain: "ethanyanxu.com", updatedAt: new Date(now).toISOString(), hosts,
});

test("normalizes, deduplicates and sorts nested hostnames", () => {
  const parsed = parseDomainSnapshot(snapshot([
    "WWW.ETHANYANXU.COM.", "beta.gentoo.ethanyanxu.com", "www.ethanyanxu.com",
  ]), now);
  assert.deepEqual(sitesFromSnapshot(parsed), [
    { host: "beta.gentoo.ethanyanxu.com", label: "beta.gentoo" },
    { host: "www.ethanyanxu.com", label: "www" },
  ]);
});

test("rejects wildcard, service-record, foreign, apex and malformed names", () => {
  for (const host of [
    "*.ethanyanxu.com", "_dmarc.ethanyanxu.com", "ethanyanxu.com", "ethanyanxu.com.evil.test",
    "www.notethanyanxu.com", "https://www.ethanyanxu.com", "x..ethanyanxu.com",
    "-bad.ethanyanxu.com", `${"x".repeat(64)}.ethanyanxu.com`, "x.ethanyanxu.com/path", 123,
  ]) assert.throws(() => parseDomainSnapshot(snapshot(["www.ethanyanxu.com", host]), now));
});

test("rejects damaged, empty and incorrectly dated inventories", () => {
  for (const value of [
    null, {}, snapshot([]), { ...snapshot(), domain: "example.com" },
    { ...snapshot(), updatedAt: "invalid" },
    { ...snapshot(), updatedAt: new Date(now + 6 * 60_000).toISOString() },
  ]) assert.throws(() => parseDomainSnapshot(value, now));
});

test("staleness is explicit and preserves every hostname", () => {
  const parsed = parseDomainSnapshot(snapshot(), now);
  assert.equal(isSnapshotStale(parsed, now + STALE_AFTER_MS), false);
  assert.equal(isSnapshotStale(parsed, now + STALE_AFTER_MS + 1), true);
  assert.equal(parsed.hosts.length, 1);
});

test("missing or damaged runtime files preserve the last valid inventory and recover", async () => {
  let live = null;
  const read = createInventoryReader(snapshot(), async () => {
    if (live === null) throw new Error("File is unavailable");
    return live;
  }, () => now);
  assert.equal((await read()).source, "snapshot");
  live = snapshot(["new.ethanyanxu.com"]);
  assert.equal((await read()).source, "live");
  live = { broken: true };
  const saved = await read();
  assert.equal(saved.source, "last-known");
  assert.deepEqual(saved.hosts, ["new.ethanyanxu.com"]);
  live = snapshot(["new.ethanyanxu.com", "next.ethanyanxu.com"]);
  const recovered = await read();
  assert.equal(recovered.source, "live");
  assert.equal(recovered.hosts.length, 2);
});

test("committed fallback includes DNS hosts and known wildcard-backed deployments", () => {
  const parsed = parseDomainSnapshot(fallback, now);
  assert.equal(parsed.hosts.length, 36);
  for (const host of ["map", "ai", "paper", "legacy.class", "nightly.gentoo", "studio"]) {
    assert.ok(parsed.hosts.includes(`${host}.ethanyanxu.com`));
  }
});
