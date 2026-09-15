import { RNG } from '../core/rng';
import { dayToDate } from '../time/calendar';
import type { WeatherKind } from './types';

interface Entry {
  kind: WeatherKind;
  weight: number;
  temp: [number, number];
}

/** Season -> weather distribution. Month index decides the season. */
const SEASONS: Entry[][] = [
  // Winter (Dec-Feb)
  [
    { kind: 'bewölkt', weight: 32, temp: [-2, 6] },
    { kind: 'schnee', weight: 20, temp: [-8, 1] },
    { kind: 'regen', weight: 18, temp: [1, 7] },
    { kind: 'klar', weight: 16, temp: [-6, 5] },
    { kind: 'nebel', weight: 10, temp: [-3, 4] },
    { kind: 'sturm', weight: 4, temp: [0, 8] },
  ],
  // Spring (Mar-May)
  [
    { kind: 'klar', weight: 30, temp: [8, 20] },
    { kind: 'bewölkt', weight: 28, temp: [6, 17] },
    { kind: 'regen', weight: 26, temp: [5, 15] },
    { kind: 'nebel', weight: 8, temp: [4, 12] },
    { kind: 'sturm', weight: 8, temp: [7, 16] },
  ],
  // Summer (Jun-Aug)
  [
    { kind: 'klar', weight: 42, temp: [19, 29] },
    { kind: 'hitze', weight: 16, temp: [30, 39] },
    { kind: 'bewölkt', weight: 20, temp: [16, 25] },
    { kind: 'regen', weight: 15, temp: [14, 23] },
    { kind: 'sturm', weight: 7, temp: [15, 26] },
  ],
  // Autumn (Sep-Nov)
  [
    { kind: 'bewölkt', weight: 32, temp: [6, 16] },
    { kind: 'regen', weight: 28, temp: [4, 14] },
    { kind: 'klar', weight: 20, temp: [7, 18] },
    { kind: 'nebel', weight: 12, temp: [3, 11] },
    { kind: 'sturm', weight: 8, temp: [5, 15] },
  ],
];

const seasonOf = (month: number): number => {
  if (month === 11 || month <= 1) return 0;
  if (month <= 4) return 1;
  if (month <= 7) return 2;
  return 3;
};

/** Weather nudges outdoor appeal and mood; it never blocks actions outright. */
export class Weather {
  kind: WeatherKind = 'klar';
  temperature = 14;
  intensity = 0.3;
  until = 0;
  /** Player override keeps the forced weather until the player releases it. */
  locked = false;

  update(totalMinutes: number, day: number, rng: RNG): boolean {
    if (this.locked || totalMinutes < this.until) return false;
    const table = SEASONS[seasonOf(dayToDate(day).month)];
    const idx = rng.weightedIndex(table.map((e) => e.weight));
    const e = table[idx < 0 ? 0 : idx];
    this.kind = e.kind;
    this.temperature = Math.round(rng.float(e.temp[0], e.temp[1]));
    this.intensity = rng.float(0.25, 1);
    this.until = totalMinutes + rng.int(240, 1500);
    return true;
  }

  force(kind: WeatherKind, temperature?: number): void {
    this.kind = kind;
    if (temperature !== undefined) this.temperature = temperature;
    this.intensity = 0.85;
    this.locked = true;
  }

  release(totalMinutes: number): void {
    this.locked = false;
    this.until = totalMinutes;
  }

  /** Multiplier applied to the appeal of outdoor locations (0.2 .. 1.25). */
  outdoorFactor(): number {
    switch (this.kind) {
      case 'klar':
        return this.temperature > 8 ? 1.25 : 0.85;
      case 'bewölkt':
        return 0.9;
      case 'nebel':
        return 0.6;
      case 'regen':
        return 0.4 - this.intensity * 0.15;
      case 'sturm':
        return 0.2;
      case 'schnee':
        return 0.45;
      case 'hitze':
        return 0.55;
    }
  }

  /** Small per-hour mood delta while the weather holds. */
  moodDelta(): number {
    switch (this.kind) {
      case 'klar':
        return 0.35;
      case 'hitze':
        return -0.25;
      case 'regen':
        return -0.2;
      case 'sturm':
        return -0.4;
      case 'schnee':
        return 0.1;
      case 'nebel':
        return -0.15;
      default:
        return 0;
    }
  }

  serialize() {
    return {
      kind: this.kind,
      temperature: this.temperature,
      intensity: this.intensity,
      until: this.until,
      locked: this.locked,
    };
  }

  restore(d: ReturnType<Weather['serialize']>): void {
    this.kind = d.kind;
    this.temperature = d.temperature;
    this.intensity = d.intensity;
    this.until = d.until;
    this.locked = d.locked;
  }
}
