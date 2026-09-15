import { MINUTES_PER_DAY, dayToDate, type CalendarDate } from './calendar';

/** Selectable time multipliers, "0" meaning paused. */
export const SPEEDS = [0, 1, 2, 5, 10, 50, 100, 500] as const;
export type Speed = (typeof SPEEDS)[number];

/** Real-time tick rate of the engine loop. */
export const TICKS_PER_SECOND = 10;
/** Simulated minutes advanced per tick at speed 1x. */
export const MINUTES_PER_TICK_BASE = 1;

/**
 * Owns simulated time. Everything in the simulation is expressed in absolute
 * simulated minutes since the world epoch, which makes scheduling trivial.
 */
export class SimulationClock {
  /** Absolute simulated minutes since epoch. */
  totalMinutes = 0;
  speed: Speed = 1;

  private lastDay = -1;
  private lastHour = -1;
  private lastMonth = -1;
  private lastYear = -1;

  get day(): number {
    return Math.floor(this.totalMinutes / MINUTES_PER_DAY);
  }

  get minuteOfDay(): number {
    return Math.floor(this.totalMinutes) % MINUTES_PER_DAY;
  }

  get hour(): number {
    return Math.floor(this.minuteOfDay / 60);
  }

  /** Fractional hour of day (13.5 = 13:30) - used by activity curves. */
  get hourF(): number {
    return this.minuteOfDay / 60;
  }

  get date(): CalendarDate {
    return dayToDate(this.day);
  }

  get paused(): boolean {
    return this.speed === 0;
  }

  /** Simulated minutes this tick should advance. */
  minutesForTick(): number {
    return this.speed * MINUTES_PER_TICK_BASE;
  }

  advance(minutes: number): void {
    this.totalMinutes += minutes;
  }

  setSpeed(s: Speed): void {
    this.speed = s;
  }

  /**
   * Reports which coarse boundaries were crossed since the last call so the
   * engine can run hourly/daily/monthly systems exactly once per boundary.
   */
  consumeBoundaries(): { hours: number; days: number; months: number; years: number } {
    const d = this.date;
    const hourAbs = Math.floor(this.totalMinutes / 60);
    const dayAbs = this.day;
    if (this.lastHour < 0) {
      this.lastHour = hourAbs;
      this.lastDay = dayAbs;
      this.lastMonth = d.month;
      this.lastYear = d.year;
      return { hours: 0, days: 0, months: 0, years: 0 };
    }
    const hours = hourAbs - this.lastHour;
    const days = dayAbs - this.lastDay;
    let months = 0;
    let years = 0;
    if (d.month !== this.lastMonth) months = 1;
    if (d.year !== this.lastYear) years = 1;
    this.lastHour = hourAbs;
    this.lastDay = dayAbs;
    this.lastMonth = d.month;
    this.lastYear = d.year;
    return { hours, days, months, years };
  }

  serialize() {
    return { totalMinutes: this.totalMinutes, speed: this.speed };
  }

  restore(data: { totalMinutes: number; speed?: number }): void {
    this.totalMinutes = data.totalMinutes;
    this.speed = (data.speed ?? 1) as Speed;
    this.lastHour = -1;
  }
}
