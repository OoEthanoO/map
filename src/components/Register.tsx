"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Site } from "@/data/sites";
import type { PulseReport } from "@/app/api/pulse/route";
import { appearanceFor, scatter, type ScatterLayout } from "@/lib/scatter";

type Pulse = { state: "up" | "down"; ms: number };
type Layout = ScatterLayout & {
  appearances: Record<string, ReturnType<typeof appearanceFor>>;
};

export default function Register({ sites }: { sites: Site[] }) {
  const [byHost, setByHost] = useState<Record<string, Pulse>>({});
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<Layout | null>(null);
  const register = useRef<HTMLUListElement>(null);
  const entries = useRef(new Map<string, HTMLLIElement>());
  const seed = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = register.current;
    if (!element) return;

    // Keep one fresh composition per page visit. Resizing and rechecking
    // reuse it, so links do not move while someone is navigating them.
    seed.current ??= crypto.getRandomValues(new Uint32Array(1))[0];
    let disposed = false;
    let frame = 0;
    let previousWidth = 0;

    const arrange = () => {
      if (disposed) return;
      const width = Math.floor(element.clientWidth);
      if (width < 1) return;
      previousWidth = width;

      const appearances: Layout["appearances"] = {};
      const measurements = sites.flatMap((site) => {
        const entry = entries.current.get(site.host);
        if (!entry) return [];
        const appearance = appearanceFor(site.host, width, seed.current!);
        appearances[site.host] = appearance;
        entry.style.setProperty("--entry-size", `${appearance.size}px`);
        entry.style.setProperty("--entry-style", appearance.italic ? "italic" : "normal");
        const bounds = entry.getBoundingClientRect();
        return [{ host: site.host, width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) }];
      });

      setLayout({ ...scatter(measurements, width, seed.current!), appearances });
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(arrange);
    };

    arrange();
    const observer = new ResizeObserver(() => {
      if (Math.floor(element.clientWidth) !== previousWidth) schedule();
    });
    observer.observe(element);
    // Use the actual loaded letterforms for collision detection, including
    // when a first visit initially renders with a fallback font.
    void document.fonts.ready.then(() => {
      if (!disposed) schedule();
    });

    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [sites]);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pulse", { cache: "no-store" });
      if (!res.ok) throw new Error("Pulse is unavailable");
      const report: PulseReport = await res.json();
      const next: Record<string, Pulse> = {};
      for (const r of report.results) next[r.host] = { state: r.state, ms: r.ms };
      setByHost(next);
      setCheckedAt(report.checkedAt);
    } catch {
      // Keep the complete inventory visible even when health checks fail.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const up = sites.filter((site) => byHost[site.host]?.state === "up").length;

  return (
    <>
      <ul
        ref={register}
        className={`register${layout ? " register--scattered" : ""}`}
        style={layout ? { height: layout.height } : undefined}
        aria-label="Subdomains of ethanyanxu.com"
        role="list"
      >
        {sites.map((site) => {
          const pulse = byHost[site.host];
          const state = pulse?.state ?? (loading ? "waiting" : "unknown");
          const position = layout?.positions[site.host];
          const appearance = layout?.appearances[site.host];
          return (
            <li
              key={site.host}
              ref={(entry) => {
                if (entry) entries.current.set(site.host, entry);
                else entries.current.delete(site.host);
              }}
              className="entry"
              style={
                position && appearance
                  ? ({
                      "--entry-size": `${appearance.size}px`,
                      "--entry-style": appearance.italic ? "italic" : "normal",
                      left: position.x,
                      top: position.y,
                    } as CSSProperties)
                  : undefined
              }
            >
              <a
                className={`entry__link is-${state}`}
                href={`https://${site.host}`}
                title={site.host}
                target="_blank"
                rel="noreferrer noopener"
              >
                {site.label}
                <span className="sr">
                  {" "}— {site.host},{" "}
                  {state === "up"
                    ? `answering in ${pulse!.ms} milliseconds`
                    : state === "down"
                      ? "no answer"
                      : state === "waiting"
                        ? "checking"
                        : "not checked"}
                  . Opens in a new tab.
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
        <span aria-live="polite" aria-atomic="true">
          {up}/{sites.length} answering
        </span>
        <button
          type="button"
          className="recheck"
          onClick={() => void check()}
          disabled={loading}
        >
          {loading ? "checking" : "recheck"}
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
