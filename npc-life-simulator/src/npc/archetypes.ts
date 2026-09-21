import { RNG } from '../core/rng';
import { clamp } from '../core/math';
import type { Attributes, Personality } from './types';

export type ArchetypeId =
  | 'careerist'
  | 'socialite'
  | 'homebody'
  | 'family'
  | 'drifter'
  | 'craftsman'
  | 'thinker'
  | 'hedonist'
  | 'caregiver'
  | 'loner';

export interface Archetype {
  id: ArchetypeId;
  label: string;
  /** Short description shown on the NPC's profile. */
  blurb: string;
  weight: number;
  /** Trait targets the roll is pulled towards, 0..100. */
  traits: Partial<Personality>;
  attrs: Partial<Attributes>;
  /** Preferred hobbies, drawn first when the NPC is created. */
  hobbies: string[];
}

/**
 * Archetypes pull an NPC's traits towards a coherent character instead of
 * letting ten independent gaussians average everyone into the same person.
 * Two NPCs of the same archetype still differ - the pull is partial.
 */
export const ARCHETYPES: Archetype[] = [
  {
    id: 'careerist',
    label: 'Karrieremensch',
    blurb: 'arbeitet viel, plant weit, wenig Freizeit',
    weight: 13,
    traits: { ambition: 88, conscientiousness: 80, extraversion: 58, agreeableness: 42, impulsivity: 25 },
    attrs: { discipline: 82, confidence: 74 },
    hobbies: ['Schach', 'Joggen', 'Lesen'],
  },
  {
    id: 'socialite',
    label: 'Gesellige/r',
    blurb: 'kennt halbe Stadt, ständig unterwegs',
    weight: 13,
    traits: { extraversion: 90, openness: 72, agreeableness: 70, impulsivity: 62, conscientiousness: 42 },
    attrs: { social: 86, humor: 76, confidence: 78 },
    hobbies: ['Tanzen', 'Reisen', 'Brettspiele'],
  },
  {
    id: 'homebody',
    label: 'Stubenhocker/in',
    blurb: 'lebt zurückgezogen, mag Routine',
    weight: 12,
    traits: { extraversion: 22, openness: 35, conscientiousness: 62, stability: 62, risk: 22 },
    attrs: { social: 32, confidence: 40 },
    hobbies: ['Gaming', 'Filme', 'Kochen'],
  },
  {
    id: 'family',
    label: 'Familienmensch',
    blurb: 'Familie geht vor, verlässlich',
    weight: 14,
    traits: { empathy: 84, loyalty: 86, agreeableness: 78, ambition: 40, risk: 28 },
    attrs: { social: 68, discipline: 66 },
    hobbies: ['Gartenarbeit', 'Backen', 'Wandern'],
  },
  {
    id: 'drifter',
    label: 'Sprunghafte/r',
    blurb: 'impulsiv, wechselt oft Job und Wohnung',
    weight: 10,
    traits: { impulsivity: 88, risk: 80, conscientiousness: 25, ambition: 48, stability: 32 },
    attrs: { discipline: 28 },
    hobbies: ['Motorrad', 'Klettern', 'Musik'],
  },
  {
    id: 'craftsman',
    label: 'Praktiker/in',
    blurb: 'macht Dinge mit den Händen, bodenständig',
    weight: 12,
    traits: { conscientiousness: 76, openness: 42, ambition: 50, stability: 70 },
    attrs: { discipline: 74 },
    hobbies: ['Basteln', 'Angeln', 'Radfahren'],
  },
  {
    id: 'thinker',
    label: 'Kopfmensch',
    blurb: 'neugierig, liest viel, eher still',
    weight: 9,
    traits: { openness: 88, extraversion: 34, conscientiousness: 66, ambition: 56 },
    attrs: { intelligence: 82, social: 42 },
    hobbies: ['Lesen', 'Programmieren', 'Schach'],
  },
  {
    id: 'hedonist',
    label: 'Genießer/in',
    blurb: 'lebt im Moment, gibt gern Geld aus',
    weight: 9,
    traits: { impulsivity: 78, openness: 72, extraversion: 72, conscientiousness: 30 },
    attrs: { humor: 74 },
    hobbies: ['Kochen', 'Reisen', 'Musik'],
  },
  {
    id: 'caregiver',
    label: 'Fürsorgliche/r',
    blurb: 'kümmert sich, stellt sich hinten an',
    weight: 9,
    traits: { empathy: 90, agreeableness: 86, ambition: 32, loyalty: 78 },
    attrs: { social: 70, aggression: 22 },
    hobbies: ['Backen', 'Yoga', 'Gartenarbeit'],
  },
  {
    id: 'loner',
    label: 'Einzelgänger/in',
    blurb: 'braucht wenig Gesellschaft, eigener Kopf',
    weight: 9,
    traits: { extraversion: 15, agreeableness: 34, openness: 58, loyalty: 44 },
    attrs: { social: 24, confidence: 52 },
    hobbies: ['Wandern', 'Fotografie', 'Angeln'],
  },
];

const TOTAL_WEIGHT = ARCHETYPES.reduce((a, t) => a + t.weight, 0);

export function pickArchetype(rng: RNG): Archetype {
  let r = rng.next() * TOTAL_WEIGHT;
  for (const a of ARCHETYPES) {
    if (r < a.weight) return a;
    r -= a.weight;
  }
  return ARCHETYPES[0];
}

export const archetypeById = (id: string): Archetype | undefined =>
  ARCHETYPES.find((a) => a.id === id);

/** Pulls a rolled value part of the way towards the archetype's target. */
export const pullToward = (rolled: number, target: number | undefined, strength: number): number =>
  target === undefined ? rolled : clamp(Math.round(rolled * (1 - strength) + target * strength), 1, 99);
