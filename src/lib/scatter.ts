export type MeasuredEntry = { host: string; width: number; height: number };
export type ScatterLayout = {
  height: number;
  positions: Record<string, { x: number; y: number }>;
};

function randomFrom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function appearanceFor(host: string, width: number, seed: number) {
  let hash = seed;
  for (const char of host) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const random = randomFrom(hash);
  const maximum = Math.min(80, Math.max(38, width * 0.085));
  const minimum = Math.min(26, maximum * 0.64);
  return {
    size: Math.round((minimum + random() * (maximum - minimum)) * 10) / 10,
    italic: random() < 0.28,
  };
}

/** Scatter measured boxes over a continuous plane, leaving room for focus rings. */
export function scatter(entries: MeasuredEntry[], width: number, seed: number): ScatterLayout {
  if (!entries.length || width <= 0) return { height: 0, positions: {} };
  const random = randomFrom(seed);
  const gap = width < 480 ? 12 : 20;
  const boxes = entries.map((entry) => ({
    ...entry,
    width: Math.min(width, entry.width),
    priority: random(),
  }));
  // Large words need the most free space. Randomize equal-sized entries too.
  boxes.sort((a, b) => b.width * b.height - a.width * a.height || a.priority - b.priority);
  const area = boxes.reduce((sum, box) => sum + (box.width + gap) * (box.height + gap), 0);
  let height = Math.max(width > 640 ? 480 : 360, area / (width * 0.48));
  const placed: Array<MeasuredEntry & { x: number; y: number }> = [];
  const positions: ScatterLayout["positions"] = {};

  for (const box of boxes) {
    height = Math.max(height, box.height);
    let position: { x: number; y: number } | undefined;

    for (let attempt = 0; attempt < 600; attempt++) {
      const x = Math.floor(random() * Math.max(0, width - box.width));
      const y = Math.floor(random() * Math.max(0, height - box.height));
      const intersects = placed.some((other) =>
        x < other.x + other.width + gap &&
        x + box.width + gap > other.x &&
        y < other.y + other.height + gap &&
        y + box.height + gap > other.y,
      );
      if (!intersects) {
        position = { x, y };
        break;
      }
    }

    if (!position) {
      // A dense or very narrow viewport can run out of room. Grow the
      // canvas instead of allowing overlap, clipping, or hiding a host.
      const bottom = Math.max(0, ...placed.map((other) => other.y + other.height));
      position = {
        x: Math.floor(random() * Math.max(0, width - box.width)),
        y: Math.ceil(bottom + gap + random() * gap * 2),
      };
      height = position.y + box.height;
    }

    positions[box.host] = position;
    placed.push({ ...box, ...position });
  }

  const bottom = Math.max(...placed.map((box) => box.y + box.height));
  return { height: Math.ceil(bottom), positions };
}
