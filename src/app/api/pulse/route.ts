import { NextResponse } from "next/server";
import { sites } from "@/data/sites";

export const dynamic = "force-dynamic";

export type Pulse = {
  host: string;
  /** `up` = answered, `down` = refused or timed out, `unknown` = never asked. */
  state: "up" | "down";
  status: number | null;
  ms: number;
};

export type PulseReport = {
  checkedAt: string;
  results: Pulse[];
};

const TTL_MS = 60_000;
const TIMEOUT_MS = 8_000;

let cache: { at: number; report: PulseReport } | null = null;

async function ping(host: string): Promise<Pulse> {
  const started = Date.now();
  const url = `https://${host}/`;

  // Some hosts refuse HEAD; fall back to a GET we immediately drop.
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "map.ethanyanxu.com pulse" },
      });
      if (method === "HEAD" && (res.status === 405 || res.status === 501)) {
        continue;
      }
      return {
        host,
        state: res.status < 500 ? "up" : "down",
        status: res.status,
        ms: Date.now() - started,
      };
    } catch {
      if (method === "GET") break;
    }
  }

  return { host, state: "down", status: null, ms: Date.now() - started };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.report);
  }

  const results = await Promise.all(sites.map((s) => ping(s.host)));
  const report: PulseReport = { checkedAt: new Date().toISOString(), results };
  cache = { at: Date.now(), report };

  return NextResponse.json(report);
}
