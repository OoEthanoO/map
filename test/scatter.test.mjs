import assert from "node:assert/strict";
import test from "node:test";
import { appearanceFor, scatter } from "../src/lib/scatter.ts";

test("all hosts fit without collisions across mobile, desktop and dense inventories", () => {
  for (const width of [240, 320, 640, 1100, 1600]) {
    for (const count of [1, 34, 120]) {
      for (let seed = 0; seed < 30; seed++) {
        const entries = Array.from({ length: count }, (_, index) => ({
          host: `site-${index}.ethanyanxu.com`,
          width: Math.min(width, 60 + ((index * 53 + seed * 13) % 350)),
          height: 44 + ((index * 17 + seed * 19) % 80),
        }));
        const { height, positions } = scatter(entries, width, seed);
        assert.equal(Object.keys(positions).length, entries.length);
        for (const [index, entry] of entries.entries()) {
          const position = positions[entry.host];
          assert.ok(position.x >= 0 && position.x + entry.width <= width);
          assert.ok(position.y >= 0 && position.y + entry.height <= height);
          for (const other of entries.slice(index + 1)) {
            const next = positions[other.host];
            assert.ok(
              position.x + entry.width <= next.x || next.x + other.width <= position.x ||
              position.y + entry.height <= next.y || next.y + other.height <= position.y,
              `${entry.host} intersects ${other.host} at width ${width}, seed ${seed}`,
            );
          }
        }
      }
    }
  }
});

test("new visits change sizes and positions; a retained seed keeps the composition stable", () => {
  const entries = Array.from({ length: 34 }, (_, index) => ({ host: `${index}.ethanyanxu.com`, width: 160, height: 65 }));
  assert.deepEqual(scatter(entries, 1100, 53), scatter(entries, 1100, 53));
  assert.notDeepEqual(scatter(entries, 1100, 53), scatter(entries, 1100, 54));
  assert.notDeepEqual(
    entries.map((entry) => appearanceFor(entry.host, 1100, 53)),
    entries.map((entry) => appearanceFor(entry.host, 1100, 54)),
  );
});

test("an empty inventory is a valid empty composition", () => {
  assert.deepEqual(scatter([], 1100, 1), { height: 0, positions: {} });
});
