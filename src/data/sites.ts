/**
 * The register.
 *
 * One entry per live host. `label` is what gets set on the page — the
 * subdomain alone, since the apex is in the header. `size` and `indent` are
 * multiples of the type unit; they're hand-set per entry so the list reads as
 * a composition rather than a table. Nothing is generated at random.
 *
 * To add a site: append here and give it a size and indent that don't collide
 * with its neighbours.
 */

export type Site = {
  host: string;
  label: string;
  /** Multiple of --unit. Roughly 2 (quiet) to 5.6 (loud). */
  size: number;
  /** Left offset, in multiples of --unit. */
  indent: number;
  italic?: boolean;
};

export const sites: Site[] = [
  { host: "www.ethanyanxu.com", label: "www", size: 4.6, indent: 0, italic: true },
  { host: "studio.ethanyanxu.com", label: "studio", size: 3.4, indent: 6 },
  { host: "tides.ethanyanxu.com", label: "tides", size: 2.6, indent: 2, italic: true },
  { host: "cora.ethanyanxu.com", label: "cora", size: 5.2, indent: 10 },
  { host: "stroj.ethanyanxu.com", label: "stroj", size: 4.0, indent: 0 },
  { host: "coolroute.ethanyanxu.com", label: "coolroute", size: 2.4, indent: 4 },
  { host: "usage.ethanyanxu.com", label: "usage", size: 2.0, indent: 0 },
  { host: "csp.ethanyanxu.com", label: "csp", size: 2.9, indent: 12 },
  { host: "learn.ethanyanxu.com", label: "learn", size: 4.6, indent: 18, italic: true },
  { host: "freedom.ethanyanxu.com", label: "freedom", size: 3.9, indent: 2 },
  { host: "planner.ethanyanxu.com", label: "planner", size: 2.2, indent: 10 },
  { host: "time.ethanyanxu.com", label: "time", size: 4.2, indent: 0 },
  { host: "todo.ethanyanxu.com", label: "todo", size: 2.0, indent: 6 },
  { host: "dashboard.ethanyanxu.com", label: "dashboard", size: 2.1, indent: 14 },
  { host: "finprint.ethanyanxu.com", label: "finprint", size: 3.2, indent: 0, italic: true },
  { host: "orgchem.ethanyanxu.com", label: "orgchem", size: 2.4, indent: 8 },
  { host: "gentoo.ethanyanxu.com", label: "gentoo", size: 4.2, indent: 2 },
  { host: "beta.gentoo.ethanyanxu.com", label: "beta.gentoo", size: 1.9, indent: 22, italic: true },
];
