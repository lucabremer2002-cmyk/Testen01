/** A simplified 365-day calendar - no leap years, which keeps day math exact. */
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY; // 1440
export const DAYS_PER_YEAR = 365;
export const MINUTES_PER_YEAR = MINUTES_PER_DAY * DAYS_PER_YEAR;

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
] as const;
export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
] as const;
export const WEEKDAY_NAMES = [
  'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag',
] as const;
export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

export const START_YEAR = 2025;

const MONTH_OFFSET: number[] = (() => {
  const out: number[] = [];
  let acc = 0;
  for (const d of MONTH_DAYS) {
    out.push(acc);
    acc += d;
  }
  return out;
})();

export interface CalendarDate {
  year: number;
  /** 0-based month index. */
  month: number;
  /** 1-based day of month. */
  day: number;
  /** 0 = Monday. */
  weekday: number;
  dayOfYear: number;
}

/** Converts an absolute simulation day (day 0 = 1 Jan of START_YEAR) into a date. */
export function dayToDate(absoluteDay: number): CalendarDate {
  const d = Math.floor(absoluteDay);
  let year = Math.floor(d / DAYS_PER_YEAR);
  let dayOfYear = d - year * DAYS_PER_YEAR;
  if (dayOfYear < 0) {
    dayOfYear += DAYS_PER_YEAR;
    year -= 1;
  }
  let month = 11;
  for (let i = 0; i < 12; i++) {
    if (dayOfYear < MONTH_OFFSET[i] + MONTH_DAYS[i]) {
      month = i;
      break;
    }
  }
  return {
    year: START_YEAR + year,
    month,
    day: dayOfYear - MONTH_OFFSET[month] + 1,
    // Day 0 (1 Jan 2025) was a Wednesday -> index 2.
    weekday: ((d % 7) + 7 + 2) % 7,
    dayOfYear,
  };
}

/** Absolute day for a calendar date (inverse of dayToDate). */
export function dateToDay(year: number, month: number, day: number): number {
  return (year - START_YEAR) * DAYS_PER_YEAR + MONTH_OFFSET[month] + (day - 1);
}

export const isWeekend = (absoluteDay: number): boolean => {
  const w = dayToDate(absoluteDay).weekday;
  return w >= 5;
};

export function formatDate(absoluteDay: number, short = false): string {
  const d = dayToDate(absoluteDay);
  const m = short ? MONTH_SHORT[d.month] : MONTH_NAMES[d.month];
  return `${d.day}. ${m} ${d.year}`;
}

export function formatDateTime(absoluteMinute: number): string {
  const day = Math.floor(absoluteMinute / MINUTES_PER_DAY);
  return `${formatDate(day, true)}, ${formatClock(absoluteMinute)}`;
}

export function formatClock(absoluteMinute: number): string {
  const m = ((Math.floor(absoluteMinute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${h < 10 ? '0' : ''}${h}:${mi < 10 ? '0' : ''}${mi}`;
}

/** "3 Std. 20 Min." style duration for the UI. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h < 24) return rest ? `${h} Std. ${rest} Min.` : `${h} Std.`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? 'Tag' : 'Tage'}`;
}
