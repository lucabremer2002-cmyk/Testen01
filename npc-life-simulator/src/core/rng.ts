/**
 * Deterministic seeded RNG (mulberry32).
 * Every random decision in the simulation goes through an RNG instance so that
 * a world is fully reproducible from its seed.
 */
export class RNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }

  /** Raw float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Picks an index using positive weights. Returns -1 for an empty/zero list. */
  weightedIndex(weights: readonly number[], count = weights.length): number {
    let total = 0;
    for (let i = 0; i < count; i++) total += weights[i] > 0 ? weights[i] : 0;
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < count; i++) {
      const w = weights[i] > 0 ? weights[i] : 0;
      if (r < w) return i;
      r -= w;
    }
    return count - 1;
  }

  /** Normally distributed value (Box-Muller), clamped to +-4 sigma. */
  gauss(mean: number, sd: number): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + sd * Math.max(-4, Math.min(4, n));
  }

  /** Gaussian value clamped into [min, max] - used for trait rolls. */
  trait(mean = 50, sd = 18, min = 1, max = 99): number {
    return Math.round(Math.max(min, Math.min(max, this.gauss(mean, sd))));
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /** Independent stream derived from this one - keeps subsystems decoupled. */
  fork(salt: number): RNG {
    return new RNG((this.s ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0);
  }

  getState(): number {
    return this.s;
  }

  setState(s: number): void {
    this.s = s >>> 0;
  }
}

/** Turns an arbitrary string into a numeric seed. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
