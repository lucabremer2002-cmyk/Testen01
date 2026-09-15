import type { LifeStage, NPC } from './types';
import { DAYS_PER_YEAR } from '../time/calendar';

export function ageOf(npc: NPC, currentDay: number): number {
  return Math.floor((currentDay - npc.birthDay) / DAYS_PER_YEAR);
}

export function ageFloat(npc: NPC, currentDay: number): number {
  return (currentDay - npc.birthDay) / DAYS_PER_YEAR;
}

export function stageForAge(age: number): LifeStage {
  if (age <= 5) return 'baby';
  if (age <= 12) return 'child';
  if (age <= 17) return 'teen';
  if (age <= 29) return 'young';
  if (age <= 49) return 'adult';
  if (age <= 64) return 'midlife';
  return 'senior';
}

export const RETIREMENT_AGE = 67;
export const WORKING_AGE = 18;
export const SCHOOL_AGE = 6;

export const isWorkingAge = (age: number): boolean => age >= WORKING_AGE && age < RETIREMENT_AGE;
export const isAdult = (age: number): boolean => age >= 18;

/** Annual mortality hazard (Gompertz-ish) modified by health. */
export function mortalityPerYear(age: number, health: number): number {
  // Calibrated so a healthy 40-year-old faces ~0.1%/year and an 85-year-old ~5%.
  const base = 0.00005 * Math.exp(0.0875 * age);
  const infant = age < 1 ? 0.004 : 0;
  const healthFactor = 2.4 - (health / 100) * 1.8; // 0.6 (perfect) .. 2.4 (broken)
  return Math.min(0.9, (base + infant) * healthFactor);
}

/** Daily health drift: young people recover, older ones decline. */
export function healthDrift(age: number): number {
  if (age < 25) return 0.05;
  if (age < 45) return 0.0;
  if (age < 60) return -0.02;
  if (age < 75) return -0.045;
  return -0.08;
}

/** Fertility window and probability per month of trying. */
export function fertility(age: number, gender: 'm' | 'w'): number {
  if (gender === 'm') return age >= 18 && age <= 60 ? 0.9 : 0;
  if (age < 18 || age > 45) return 0;
  if (age <= 30) return 0.9;
  if (age <= 37) return 0.6;
  return 0.25;
}

/** Peak energy ceiling by age - seniors simply have less in the tank. */
export function energyCeiling(age: number): number {
  if (age < 12) return 100;
  if (age < 30) return 100;
  if (age < 50) return 96;
  if (age < 65) return 90;
  return 82;
}
