// Seedbarer PRNG (mulberry32). Der Zustand liegt im GameState, damit Partien reproduzierbar sind.

export function nextRandom(s: { rng: number }): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(s: { rng: number }, n: number): number {
  return Math.floor(nextRandom(s) * n);
}

export function d6(s: { rng: number }): number {
  return 1 + randInt(s, 6);
}

export function pick<T>(s: { rng: number }, arr: readonly T[]): T {
  return arr[randInt(s, arr.length)];
}

export function weighted<K extends string>(s: { rng: number }, weights: Partial<Record<K, number>>): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = nextRandom(s) * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r < 0) return k;
  }
  return entries[entries.length - 1][0];
}

export function shuffle<T>(s: { rng: number }, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function seedToState(seed: number): number {
  return seed | 0;
}

