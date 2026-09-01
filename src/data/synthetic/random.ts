/**
 * Deterministic PRNG so a seed always reproduces the same cohort. The generator
 * feeds test fixtures as well as the sample data set, and a moving target there
 * would make failures impossible to reproduce.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  float(min = 0, max = 1): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  /** Rounded to the nearest `step`, which keeps generated amounts readable. */
  money(min: number, max: number, step = 1_000): number {
    return Math.round(this.float(min, max) / step) * step;
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty list.');
    return items[Math.floor(this.float(0, items.length))] ?? items[0]!;
  }

  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const picked: T[] = [];
    for (let i = 0; i < count && pool.length > 0; i += 1) {
      picked.push(...pool.splice(Math.floor(this.float(0, pool.length)), 1));
    }
    return picked;
  }
}
