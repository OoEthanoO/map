"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { sites } from "@/data/sites";
import type { PulseReport } from "@/app/api/pulse/route";

type Pulse = { state: "up" | "down"; ms: number };

export default function Register() {
  const [byHost, setByHost] = useState<Record<string, Pulse>>({});
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pulse", { cache: "no-store" });
      const report: PulseReport = await res.json();
      const next: Record<string, Pulse> = {};
      for (const r of report.results) next[r.host] = { state: r.state, ms: r.ms };
      setByHost(next);
      setCheckedAt(report.checkedAt);
    } catch {
      /* leave the marks unresolved */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const up = Object.values(byHost).filter((p) => p.state === "up").length;

  return (
    <>
      <ul className="register">
        {sites.map((site) => {
          const pulse = byHost[site.host];
          const state = pulse?.state ?? "waiting";
          return (
            <li
              key={site.host}
              className="entry"
              style={
                {
                  "--s": site.size,
                  "--i": site.indent,
                } as CSSProperties
              }
            >
              <a
                className={[
                  "entry__link",
                  `is-${state}`,
                  site.italic && "entry__link--italic",
                ]
                  .filter(Boolean)
                  .join(" ")}
                href={`https://${site.host}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {site.label}
                <span className="sr">
                  {" "}
                  — {site.host},{" "}
                  {state === "up"
                    ? `answering in ${pulse!.ms} milliseconds`
                    : state === "down"
                      ? "no answer"
                      : "checking"}
                </span>
              </a>
              <span className="entry__ms" aria-hidden="true">
                {pulse?.state === "up" ? `${pulse.ms}ms` : pulse ? "—" : ""}
              </span>
            </li>
          );
        })}
      </ul>

      <footer className="colophon">
        <span>
          {up}/{sites.length}
        </span>
        <button
          type="button"
          className="recheck"
          onClick={() => void check()}
          disabled={loading}
        >
          {loading ? "···" : "recheck"}
        </button>
        <span>
          {checkedAt
            ? new Date(checkedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </span>
      </footer>
    </>
  );
}
