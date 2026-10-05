import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createPulseService } from "../src/lib/pulse.ts";

test("shares simultaneous checks, bounds concurrency and caches by the inventory", async () => {
  let active = 0;
  let peak = 0;
  let requests = 0;
  let now = 0;
  const service = createPulseService({
    concurrency: 3,
    now: () => now,
    ttlMs: 100,
    fetchImpl: async () => {
      requests++;
      peak = Math.max(peak, ++active);
      await delay(2);
      active--;
      return new Response(null, { status: 200 });
    },
  });
  const hosts = Array.from({ length: 11 }, (_, i) => `host${i}.ethanyanxu.com`);
  const reports = await Promise.all([service.getReport(hosts), service.getReport(hosts), service.getReport(hosts)]);
  assert.equal(requests, 11);
  assert.equal(peak, 3);
  assert.strictEqual(reports[0], reports[1]);
  assert.deepEqual(reports[0].results.map(({ host }) => host), hosts);
  await service.getReport(hosts);
  assert.equal(requests, 11);
  await service.getReport([...hosts, "new.ethanyanxu.com"]);
  assert.equal(requests, 23);
  now = 101;
  await service.getReport([...hosts, "new.ethanyanxu.com"]);
  assert.equal(requests, 35);
});

test("HEAD fallback shares its deadline, closes bodies and keeps unavailable hosts", async () => {
  const requests = [];
  const signals = [];
  let cancelled = 0;
  const service = createPulseService({
    fetchImpl: async (url, options) => {
      requests.push([url, options.method]);
      signals.push(options.signal);
      if (url.includes("offline")) throw new Error("Network unavailable");
      return new Response(new ReadableStream({ cancel() { cancelled++; } }), {
        status: options.method === "HEAD" ? 405 : 200,
      });
    },
  });
  const report = await service.getReport(["fallback.ethanyanxu.com", "offline.ethanyanxu.com"]);
  assert.equal(requests.filter(([url]) => url.includes("fallback")).length, 2);
  const fallbackSignals = requests.flatMap(([url], index) => url.includes("fallback") ? [signals[index]] : []);
  assert.strictEqual(fallbackSignals[0], fallbackSignals[1]);
  assert.equal(cancelled, 2);
  assert.equal(report.results.length, 2);
  assert.deepEqual(report.results.map(({ state, status }) => ({ state, status })), [
    { state: "up", status: 200 }, { state: "down", status: null },
  ]);
});

test("a stalled request expires and remains present in the result", async () => {
  const service = createPulseService({
    timeoutMs: 10,
    fetchImpl: async (_, { signal }) => {
      await delay(1_000, undefined, { signal });
      throw new Error("Should have been aborted");
    },
  });
  const report = await service.getReport(["stalled.ethanyanxu.com"]);
  assert.equal(report.results[0].state, "down");
  assert.equal(report.results[0].host, "stalled.ethanyanxu.com");
  assert.ok(report.results[0].ms < 900);
});
